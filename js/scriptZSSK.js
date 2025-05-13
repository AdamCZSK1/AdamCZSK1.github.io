const socket = new WebSocket("ws://localhost:5000/ws");

let showTrainInfo = true;

socket.onopen = () => {
    console.log("✅ WebSocket připojen!");
};

socket.onmessage = async (event) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(event.data, "text/xml");

    // ✅ Načítání informací o vlaku
    const trainNumber = getXmlValue(xmlDoc, "Train", "Number");
    const trainName = getXmlValue(xmlDoc, "Train", "Name");
    const trainCategory = getXmlValue(xmlDoc, "Train", "Category");

    // ✅ Načítání výchozí a cílové stanice
    const departureStation = getRouteStation(xmlDoc, "first");
    const arrivalStation = getRouteStation(xmlDoc, "last");

    // ✅ Načítání LineIDS
    const lineIDS = getXmlValue(xmlDoc, "CurrentStation", "LineIDS");

    // ✅ Načítání času odjezdu, aktuální stanice a typu stanice
    const plannedArrival = getXmlValue(xmlDoc, "CurrentStation", "ArrTime");
    const plannedDeparture = getXmlValue(xmlDoc, "CurrentStation", "DepTime");
    const currentStation = getXmlValue(xmlDoc, "CurrentStation", "Name");
    const stationType = getXmlValue(xmlDoc, "CurrentStation", "StationType");
    const state = getXmlValue(xmlDoc, "CurrentStation", "State");
    const sr70 = getXmlValue(xmlDoc, "CurrentStation", "SR70");
	
    // ✅ Načítání seznamu nácestných stanic
    const nextStations = getNextStations(xmlDoc, currentStation);

    updateTrainInfo(trainNumber, trainName, trainCategory, departureStation, arrivalStation, lineIDS);
    updateDepartureInfo(plannedArrival, plannedDeparture, currentStation, stationType, state);
    
    // ✅ Vyhledání tarifní zóny a aktualizace na webu
    findTariffZone(sr70);

    updateNextStations(nextStations);
};

socket.onerror = (error) => {
    console.error("❌ WebSocket chyba:", error);
};

function getXmlValue(xmlDoc, parentTag, childTag) {
    const parent = xmlDoc.getElementsByTagName(parentTag)[0];
    if (parent && parent.getElementsByTagName(childTag)[0]) {
        return parent.getElementsByTagName(childTag)[0].textContent;
    }
    return "--";
}

function getRouteStation(xmlDoc, position) {
    const stations = xmlDoc.getElementsByTagName("Route")[0]?.getElementsByTagName("Station");
    if (!stations || stations.length === 0) {
        return "--";
    }

    return position === "first"
        ? stations[0].getElementsByTagName("Name")[0].textContent
        : stations[stations.length - 1].getElementsByTagName("Name")[0].textContent;
}

// 📌 Načítání seznamu nácestných stanic od aktuální stanice
function getNextStations(xmlDoc, currentStationName) {
    const stations = xmlDoc.getElementsByTagName("Route")[0]?.getElementsByTagName("Station");
    let stationList = [];
    let foundCurrent = false;

    for (let i = 0; i < stations.length; i++) {
        const stationName = stations[i].getElementsByTagName("Name")[0].textContent;

        if (foundCurrent) {
            stationList.push(stationName);
        }

        if (stationName === currentStationName) {
            foundCurrent = true;
        }
    }

    return stationList; // ✅ Zobrazíme max. 6 stanic
}

// 🖥 Aktualizace hlavního panelu
function updateTrainInfo(trainNumber, trainName, trainCategory, departureStation, arrivalStation, lineIDS) {
    document.getElementById('trainNumber').innerText = trainNumber || "--";
    document.getElementById('trainCategory').innerText = trainCategory || "--";
    document.getElementById('departureStation').innerText = departureStation || "--";
    document.getElementById('arrivalStation').innerText = arrivalStation || "--";
    document.getElementById('lineIDS').innerText = lineIDS || "--";
	
	// ✅ Pokud `trainName` není dostupný, nezobrazí se pomlčka
    const trainNameElement = document.getElementById('trainName');
    if (trainName && trainName !== "--") {
        trainNameElement.innerText = ` - ${trainName}`;
    } else {
        trainNameElement.innerText = ""; // ✅ Smazání pomlčky
    }
}

function updateDepartureInfo(plannedArrival, plannedDeparture, currentStation, stationType, state) {
    let timeToDisplay = "--:--";

    if (stationType === "StartingRoute") {
        timeToDisplay = formatTime(plannedDeparture); // ✅ Použije odjezdový čas
    } else {
        timeToDisplay = formatTime(plannedArrival); // ✅ Použije příjezdový čas
    }

    // ✅ Aktualizace času na webu
    document.getElementById('plannedTime').innerText = timeToDisplay;

    // ✅ Aktualizace názvu aktuální stanice
    document.getElementById('currentStation').innerText = currentStation || "--";

    // 🔥 **Určení správného textu podle `StationType` a `State`**
    let stationLabel = "Stanica"; // Výchozí text

    if (stationType === "StartingRoute" && state === "AtStation") {
        stationLabel = "Nástupná stanica";
    } else if (stationType === "EndingRoute" && state === "AtStation") {
        stationLabel = "Cieľová stanica";
    } else if (state === "OnRoute") {
        stationLabel = "Následujúca stanica";
    } else {
        stationLabel = "Stanica";
    }
	
    // ✅ Aktualizace textu na webu
    document.getElementById('stationLabel').innerText = stationLabel;
}

// 📌 Aktualizace seznamu nácestných stanic
function updateNextStations(nextStations) {
    const stationListContainer = document.getElementById('stationList');
    stationListContainer.innerHTML = ""; // ✅ Vyčištění seznamu

    nextStations.forEach(station => {
        const stationElement = document.createElement('span');
        stationElement.textContent = station;
        stationElement.classList.add('station-item');
        stationListContainer.appendChild(stationElement);
    });
}

// ✅ Funkce pro vyhledání tarifní zóny
async function findTariffZone(sr70) {
    if (!sr70 || sr70 === "--") {
        document.getElementById("tariffZone").innerText = "";
        return;
    }

    try {
        const response = await fetch("xml/IDSzones.xml");
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const regions = xmlDoc.getElementsByTagName("Region");
        for (let region of regions) {
            const regionName = region.getAttribute("Name");
            const zones = region.getElementsByTagName("TariffZone");

            for (let zone of zones) {
                const zoneName = zone.getAttribute("Name");
                const stations = zone.getElementsByTagName("Station");

                for (let station of stations) {
                    if (station.getAttribute("SR70") === sr70) {
                        document.getElementById("tariffZone").innerText = `${zoneName}`;
                        return;
                    }
                }
            }
        }

        document.getElementById("tariffZone").innerText = ""; // Pokud není nalezena zóna
    } catch (error) {
        console.error("❌ Chyba při načítání tarifních zón:", error);
    }
}


function formatTime(timeString) {
    if (!timeString || timeString === "--:--") return "--:--";
    return timeString.replace(/^0/, ""); // ✅ Odstranění první nuly
}

// 🔄 Přepínání mezi TrainInfo a LineIDS každých 5 sekund
setInterval(() => {
    showTrainInfo = !showTrainInfo;
    document.querySelector('.train-display').classList.toggle('hidden');
    document.querySelector('.line-display').classList.toggle('hidden');
}, 5000);


function updateDateTime() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('cs-CZ', { 
        day: '2-digit', month: '2-digit', year: 'numeric' 
    }).replace(/ /g, ''); // ✅ Odstranění mezer

    const formattedTime = now.toLocaleTimeString('cs-CZ', { 
        hour: '2-digit', minute: '2-digit' 
    });

    // ✅ Ověření, zda element existuje, než se nastaví hodnota
    const dateTimeElement = document.getElementById("datetime");
    if (dateTimeElement) {
        dateTimeElement.textContent = `${formattedDate}, ${formattedTime}`;
    } else {
        console.error("❌ Element #datetime nenalezen v DOM!");
    }
}

// ✅ Čekáme, až se načte celý dokument, než spustíme interval
document.addEventListener("DOMContentLoaded", () => {
    setInterval(updateDateTime, 1000);
    updateDateTime();
});
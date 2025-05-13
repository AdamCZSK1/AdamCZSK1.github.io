const WS_URL = "ws://localhost:5000/ws";
let socket;
let reconnectInterval = 5000;

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log("✅ WebSocket připojen!");
        loadLastXmlFile();
    };

    socket.onmessage = async (event) => {
        processXmlData(event.data);
    };

    socket.onerror = (error) => {
        console.error("❌ WebSocket chyba:", error);
    };

    socket.onclose = () => {
        console.warn("⚠ WebSocket odpojen! Pokusím se znovu připojit...");
        setTimeout(connectWebSocket, reconnectInterval);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadStationNames();
    connectWebSocket();
    setInterval(updateDateTime, 1000);
    updateDateTime();
});

function processXmlData(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const status = getXmlValue(xmlDoc, "TrainInfo", "Status");

    if (status === "NoTrainSelected") {
        handleNoTrainSelected();
    } else {
        handleTrainSelected(xmlDoc);
    }
}

async function loadLastXmlFile() {
    try {
        const response = await fetch("/data/traindata.xml", { cache: "no-store" });
        if (!response.ok) throw new Error("❌ Nelze načíst poslední XML soubor.");
        
        const text = await response.text();
        processXmlData(text);
        console.log("✅ Načten poslední soubor při startu.");

        togglePanels(true);
    } catch (error) {
        console.warn("⚠ Nelze načíst poslední XML soubor.");
    }
}

function handleNoTrainSelected() {
    const logoBanner = document.getElementById("logo-banner");
    const panel1 = document.getElementById("panel-content-1");
    const panel2 = document.getElementById("panel-content-2");
	const separator1 = document.getElementById("separator-1");

    if (logoBanner) {
        logoBanner.classList.remove("hidden");
    }

    if (panel1 && panel2 && separator1) {
        panel1.classList.add("hidden");
        panel2.classList.add("hidden");
		separator1.classList.add("hidden");
    }

    document.getElementById("trainCategory").innerText = "";
    document.getElementById("trainNumber").innerText = "";
    document.getElementById("trainName").innerText = "";
    document.getElementById("departureStation").innerText = "";
    document.getElementById("stationSeparator").innerText = "";
    document.getElementById("arrivalStation").innerText = "";
    document.getElementById("lineIDS").innerText = "";
	
	isTrainSelected = false;
}

let showTrainInfo = true;
let showNextStations = true;
let toggleInterval = null;
let currentRequestStop = false;
let currentRequestStopPressed = false;
let isTrainSelected = false;

function togglePanels(forceReset = false) {
	if (!isTrainSelected) {
        return;
    }
	
	if (forceReset) {
        showTrainInfo = true;

        if (currentRequestStop && !currentRequestStopPressed) {
            showNextStations = false;
        } else {
            showNextStations = true;
        }
    } else {
        showTrainInfo = !showTrainInfo;

        if (currentRequestStop || currentRequestStopPressed) {
            showNextStations = !showNextStations;
        } else {
            showNextStations = true;
        }
    }

    document.querySelector('.train-display').classList.toggle('hidden', !showTrainInfo);
    document.querySelector('.line-display').classList.toggle('hidden', showTrainInfo);

    document.getElementById("request-stop-container").classList.toggle("hidden", showNextStations || !(currentRequestStop || currentRequestStopPressed));
    document.getElementById("panel-content-2").classList.toggle("hidden", !showNextStations);
}

toggleInterval = setInterval(() => togglePanels(false), 10000);

function handleTrainSelected(xmlDoc) {
    console.log("🚉 Vlak vybrán → Zobrazím panely, skryji logo-banner");

    const logoBanner = document.getElementById("logo-banner");
    const panel1 = document.getElementById("panel-content-1");
    const panel2 = document.getElementById("panel-content-2");
	const separator1 = document.getElementById("separator-1");

    if (logoBanner) {
        logoBanner.classList.add("hidden");
        console.log("✅ Banner by měl být SKRYT");
    }

    if (panel1 && panel2 && separator1) {
        panel1.classList.remove("hidden");
        panel2.classList.add("hidden");
		separator1.classList.remove("hidden");
        console.log("✅ Panely by měly být VIDĚT");
    }
	
    const trainNumber = getXmlValue(xmlDoc, "Train", "Number");
    const trainName = getXmlValue(xmlDoc, "Train", "Name");
    const trainCategory = getXmlValue(xmlDoc, "Train", "Category");

    const stations = xmlDoc.getElementsByTagName("Route")[0]?.getElementsByTagName("Station");
	const firstStation = stations ? stations[0] : null;
	const lastStation = stations ? stations[stations.length - 1] : null;

	const departureSr70 = firstStation ? firstStation.getElementsByTagName("SR70")[0]?.textContent : null;
	const arrivalSr70 = lastStation ? lastStation.getElementsByTagName("SR70")[0]?.textContent : null;

	const departureStation = getCorrectedStationName(firstStation?.getElementsByTagName("Name")[0]?.textContent || "", departureSr70);
	const arrivalStation = getCorrectedStationName(lastStation?.getElementsByTagName("Name")[0]?.textContent || "", arrivalSr70);
	
    const lineIDS = getXmlValue(xmlDoc, "CurrentStation", "LineIDS");
	
    const plannedArrival = getXmlValue(xmlDoc, "CurrentStation", "ArrTime");
    const plannedDeparture = getXmlValue(xmlDoc, "CurrentStation", "DepTime");
    const currentSr70 = getXmlValue(xmlDoc, "CurrentStation", "SR70");
    let currentStation = getCorrectedStationName(getXmlValue(xmlDoc, "CurrentStation", "Name"), currentSr70);
    const stationType = getXmlValue(xmlDoc, "CurrentStation", "StationType");
    const state = getXmlValue(xmlDoc, "CurrentStation", "State");
    const sr70 = getXmlValue(xmlDoc, "CurrentStation", "SR70");
	
    currentRequestStop = getXmlValue(xmlDoc, "CurrentStation", "Request") === "Yes";
	currentRequestStopPressed = getXmlValue(xmlDoc, "CurrentStation", "RequestStopPressed") === "Yes";

    const nextStations = getNextStations(xmlDoc, currentSr70);

    updateTrainInfo(trainNumber, trainName, trainCategory, departureStation, arrivalStation, lineIDS);
    updateDepartureInfo(plannedArrival, plannedDeparture, currentStation, stationType, state);
    updateRequestStopIndicator(currentRequestStop, currentRequestStopPressed);
    findTariffZone(sr70);
    updateNextStations(nextStations);
	
	isTrainSelected = true;
	
	togglePanels(true);
}

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
function getNextStations(xmlDoc, currentSr70) {
    const stations = xmlDoc.getElementsByTagName("Route")[0]?.getElementsByTagName("Station");
    let stationList = [];
    let foundCurrentStation = false; // Indikátor, že jsme našli aktuální stanici

    for (let i = 0; i < stations.length; i++) {
        const stationSr70 = stations[i].getElementsByTagName("SR70")[0]?.textContent || null;
        const stationName = stations[i].getElementsByTagName("Name")[0]?.textContent || "--";
        const correctedName = getCorrectedStationName(stationName, stationSr70);

        // Jakmile najdeme aktuální stanici, přeskočíme ji a začneme přidávat další stanice
        if (foundCurrentStation) {
            stationList.push(correctedName);
        }

        // Pokud jsme našli aktuální stanici podle SR70, aktivujeme přepínač
        if (stationSr70 === currentSr70) {
            foundCurrentStation = true;
        }
    }

    return stationList; // Vrací pouze nadcházející stanice
}

// ✅ Získání správného názvu stanice (pokud existuje v alternativním seznamu)
function getCorrectedStationName(originalName, sr70) {
    if (sr70 && stationNameMap[sr70]) {
        console.log(`🔄 Nahrazuji ${originalName} → ${stationNameMap[sr70]}`); // Debug
        return stationNameMap[sr70]; // ✅ Použije zkrácený název
    }
    return originalName || "--"; // ❌ Pokud nenalezeno, použije původní
}

// 🖥 Aktualizace hlavního panelu
function updateTrainInfo(trainNumber, trainName, trainCategory, departureStation, arrivalStation, lineIDS) {

	const maxLength = 20;
	const routeText = document.getElementById("routeText");
	const depElem = document.getElementById("departureStation");
	const arrElem = document.getElementById("arrivalStation");
	const sepElem = document.getElementById("stationSeparator");

	// Zápis textů
	depElem.innerText = departureStation || "--";
	arrElem.innerText = arrivalStation || "--";
	sepElem.innerText = (departureStation && arrivalStation && departureStation !== "--" && arrivalStation !== "--") ? " — " : "";

	// Detekce – pokud aspoň jedna stanice delší než limit → ANIMACE
	const shouldScroll = departureStation.length > maxLength || arrivalStation.length > maxLength;

	routeText.classList.remove("animate-scroll");
	if (shouldScroll) {
		routeText.classList.add("animate-scroll");
	}

	// Kategorie, číslo, název vlaku
	const categoryElement = document.getElementById('trainCategory');
	const italicCategories = ["IC", "EC", "EN", "ES", "rj", "SC"];
	categoryElement.innerText = trainCategory || "--";
	categoryElement.classList.toggle("italic-category", italicCategories.includes(trainCategory));

	document.getElementById('trainNumber').innerText = trainNumber || "--";
	document.getElementById('lineIDS').innerText = lineIDS || "--";

	const trainNameElement = document.getElementById('trainName');
	trainNameElement.innerText = (trainName && trainName !== "--") ? ` - ${trainName}` : "";
}

function updateRequestStopIndicator(isRequestStop, isRequestStopPressed) {
    const requestText = document.getElementById("request-text");

    if (!requestText) {
        console.warn("⚠️ Chybí request-text!");
        return;
    }

    if (isRequestStop) {
        requestText.innerText = isRequestStopPressed ? "Zastavíme" : "Zastávka na znamení, pro výstup stiskněte tlačítko signalizace.";
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
    let stationLabel = "Stanice"; // Výchozí text

    if (stationType === "StartingRoute" && state === "AtStation") {
        stationLabel = "Výchozí stanice";
    } else if (stationType === "EndingRoute" && state === "AtStation") {
        stationLabel = "Konečná stanice";
    } else if (state === "OnRoute") {
        stationLabel = "Příští stanice";
    } else {
        stationLabel = "Stanice";
    }
	
    // ✅ Aktualizace textu na webu
    document.getElementById('stationLabel').innerText = stationLabel;
}

// 📌 Aktualizace seznamu nácestných stanic
function updateNextStations(nextStations) {
    const stationListContainer = document.getElementById('stationList');
    stationListContainer.innerHTML = ""; // ✅ Vyčištění seznamu

    nextStations.forEach((stationName) => { // ✅ Už je to jen string, takže funguje správně
        const stationElement = document.createElement('span');
        stationElement.textContent = stationName;
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

        let zoneMap = {}; // Mapa pro seskupení IDS → Zóny

        const regions = xmlDoc.getElementsByTagName("Region");
        for (let region of regions) {
            const regionName = region.getAttribute("Name"); // Např. "Moravskoslezský kraj (ODIS)"
            const zones = region.getElementsByTagName("TariffZone");

            for (let zone of zones) {
                const zoneName = zone.getAttribute("Name"); // Např. "ODIS 63"
                const stations = zone.getElementsByTagName("Station");

                for (let station of stations) {
                    if (station.getAttribute("SR70") === sr70) {
                        // Rozdělení IDS a čísla zóny
                        const [idsName, zoneNumber] = zoneName.split(" ");
                        
                        if (!zoneMap[idsName]) {
                            zoneMap[idsName] = new Set();
                        }
                        zoneMap[idsName].add(zoneNumber); // Přidáme číslo zóny
                    }
                }
            }
        }

        // Sestavení textu pro zobrazení
        let resultText = Object.entries(zoneMap)
            .map(([idsName, zones]) => `${idsName} ${Array.from(zones).join(",")}`)
            .join(", "); // Oddělení různých IDS svislou čárou "|"

        document.getElementById("tariffZone").innerText = resultText || "";

    } catch (error) {
        console.error("❌ Chyba při načítání tarifních zón:", error);
        document.getElementById("tariffZone").innerText = "";
    }
}

let stationNameMap = {}; // Ukládá mapu SR70 -> alternativní název

// ✅ Funkce pro načtení XML souboru s alternativními názvy
async function loadStationNames() {
    try {
        const response = await fetch("/xml/StationNames.xml", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("❌ Nelze načíst StationNames.xml.");
        }
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const stations = xmlDoc.getElementsByTagName("Station");
        for (let station of stations) {
            const sr70 = station.getAttribute("SR70");
            const name = station.textContent;
            if (sr70 && name) {
                stationNameMap[sr70] = name;
            }
        }
        console.log("✅ Alternativní názvy načteny:", stationNameMap);
    } catch (error) {
        console.warn("⚠ Nelze načíst alternativní názvy stanic.");
    }
}

function formatTime(timeString) {
    if (!timeString || timeString === "--:--") return "--:--";
    return timeString; // ✅ Odstranění první nuly
}


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
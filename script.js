// --- 1. CONFIGURACIÓN ---
const VISTA_INICIAL = { lat: -34.266, lng: -62.712, zoom: 14 };

const COLORES_FIJOS = {
    "AREA INDUSTRIAL": "#3333ff",
    "SECCION 1": "#33cc33",
    "SECCION 1 - QUINTAS": "#b2ff66",
    "SECCION 2": "#cc00cc",
    "SECCION 3": "#66ffff",
    "SECCION 3 - QUINTAS": "#009999",
    "SECCION 4": "#ff99cc",
    "SECCION 5": "#ffcc00",
    "SECCION 5 - QUINTAS": "#996633",
    "SECCION 6": "#ff6600",
    "SECCION 7": "#999999",
    "SECCION 8": "#ff3333",
    "SECCION 9": "#9933ff"
};
const PALETA_DEFAULT = ["#3498db", "#e74c3c", "#f1c40f", "#2ecc71", "#9b59b6", "#34495e"];

let mapaColoresSecciones = {}; 
let estadoSecciones = {}; 

const renderizador = L.canvas({ padding: 0.5 });

const ESTILOS = {
    parcela: { color: "#555", weight: 1, fillColor: "#ecf0f1", fillOpacity: 0.5, renderer: renderizador },
    parcelaHover: { color: "#e67e22", weight: 2, fillColor: "#f39c12", fillOpacity: 0.7, renderer: renderizador },
    parcelaSeleccionada: { color: "#c0392b", weight: 3, fillColor: "#e74c3c", fillOpacity: 0.8, renderer: renderizador }
};

// --- 2. FUNCIONES DE AYUDA ---
function obtenerValorSeguro(propiedades, busqueda) {
    if (!propiedades) return '-';
    if (propiedades[busqueda] !== undefined) return propiedades[busqueda];
    const clave = Object.keys(propiedades).find(k => k.toUpperCase().trim() === busqueda.toUpperCase().trim());
    if (clave) return propiedades[clave];
    const claveParcial = Object.keys(propiedades).find(k => k.toUpperCase().includes(busqueda.toUpperCase()));
    return claveParcial ? propiedades[claveParcial] : '-';
}

function obtenerColorSeccion(nombre) {
    if (!nombre) return "#ccc";
    const nombreMayus = String(nombre).toUpperCase().trim();
    for (const [clave, color] of Object.entries(COLORES_FIJOS)) {
        if (nombreMayus === clave) return color;
    }
    if (!mapaColoresSecciones[nombreMayus]) {
        const indice = Object.keys(mapaColoresSecciones).length % PALETA_DEFAULT.length;
        mapaColoresSecciones[nombreMayus] = PALETA_DEFAULT[indice];
    }
    return mapaColoresSecciones[nombreMayus];
}

// --- 3. INICIAR MAPA ---
const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([VISTA_INICIAL.lat, VISTA_INICIAL.lng], VISTA_INICIAL.zoom);
L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'Map data &copy; OpenStreetMap', maxZoom: 19 }).addTo(map);

let capaParcelas = null;
let capaSecciones = null;
let parcelaSeleccionadaLayer = null; 
let nombreColumnaSeccionGlobal = null;

// --- 4. GESTIÓN DEL ÁRBOL DE CAPAS ---
const arrowBtn = document.getElementById('arrow-sections');
const childrenContainer = document.getElementById('lista-secciones');
const masterCheck = document.getElementById('master-check-sections');

if(arrowBtn) {
    arrowBtn.addEventListener('click', () => {
        const isHidden = childrenContainer.style.display === 'none';
        childrenContainer.style.display = isHidden ? 'block' : 'none';
        arrowBtn.textContent = isHidden ? '▼' : '▶';
    });
}

if(masterCheck) {
    masterCheck.addEventListener('change', (e) => {
        const activado = e.target.checked;
        for (let key in estadoSecciones) estadoSecciones[key] = activado;
        const childCheckboxes = document.querySelectorAll('#lista-secciones input[type="checkbox"]');
        childCheckboxes.forEach(chk => chk.checked = activado);
        actualizarVisibilidadSecciones(nombreColumnaSeccionGlobal);
    });
}

function generarLeyendaSecciones(geoJsonData) {
    childrenContainer.innerHTML = ""; 
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        childrenContainer.innerHTML = "<div style='padding:5px;'>No hay datos</div>";
        return;
    }
    const primerFeature = geoJsonData.features[0].properties;
    nombreColumnaSeccionGlobal = Object.keys(primerFeature).find(k => k.toUpperCase().includes("SECCION"));

    if (!nombreColumnaSeccionGlobal) {
        childrenContainer.innerHTML = "<div style='color:red;'>Error: Sin columna SECCION</div>";
        return;
    }

    const nombresSecciones = new Set();
    geoJsonData.features.forEach(f => {
        const val = f.properties[nombreColumnaSeccionGlobal];
        if (val) nombresSecciones.add(String(val).trim());
    });
    const listaOrdenada = Array.from(nombresSecciones).sort();

    listaOrdenada.forEach(nombre => {
        estadoSecciones[nombre] = true; 
        const color = obtenerColorSeccion(nombre);

        const item = document.createElement('div');
        item.className = 'layer-item';
        
        const boxColor = document.createElement('div');
        boxColor.className = 'legend-color';
        boxColor.style.backgroundColor = color;
        
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        
        checkbox.addEventListener('change', (e) => {
            estadoSecciones[nombre] = e.target.checked;
            actualizarVisibilidadSecciones(nombreColumnaSeccionGlobal);
            if (!e.target.checked && masterCheck) masterCheck.checked = false;
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" " + nombre));
        item.appendChild(boxColor);
        item.appendChild(label);
        childrenContainer.appendChild(item);
    });
}

function actualizarVisibilidadSecciones(nombreColumna) {
    if (!capaSecciones) return;
    capaSecciones.eachLayer(layer => {
        const val = String(layer.feature.properties[nombreColumna]).trim();
        const visible = estadoSecciones[val];
        layer.setStyle({ fillOpacity: visible ? 0.4 : 0, opacity: visible ? 1 : 0 });
    });
}

// --- 5. LOGICA PARCELAS E INFORMACIÓN (AJUSTADA) ---

function seleccionarParcela(layer) {
    if (parcelaSeleccionadaLayer && capaParcelas) capaParcelas.resetStyle(parcelaSeleccionadaLayer);
    parcelaSeleccionadaLayer = layer;
    layer.setStyle(ESTILOS.parcelaSeleccionada);
    layer.bringToFront();
    
    // Zoom suave
    map.flyToBounds(layer.getBounds(), { padding: [100, 100], maxZoom: 19, duration: 0.5 });
    
    const p = layer.feature.properties;

    const CAMPOS_POPUP = [
        { label: "Titular", key: "Tit. Nombre" },
        { label: "DNI", key: "DNI" },
        { label: "Partida", key: "PARTIDA" },
        { label: "TGI", key: "TGI" },
        { label: "Ubicación", key: "Ubi. Calle" },
        { label: "Sección", key: "SECCION" },
        { label: "Manzana", key: "MANZ" },
        { label: "Lote", key: "Lote" },
        { label: "Mts Frente", key: "Frente 1" },
        { label: "Mts Fondo", key: "Fondo" },
        { label: "Superficie", key: "Superficie" },
        { label: "Ficha Cat.", key: "Ficha Catastral" },
        { label: "Deuda TGI", key: "Deuda TGI", formato: "moneda" },
        { label: "Meses Adeud.", key: "Meses Adeud.TGI" },
        { label: "Obras", key: "Obras" },
        { label: "Deuda Obras", key: "Deuda Obra", formato: "moneda" },
        { label: "Cuotas Plan", key: "Cuotas Plan" },
        { label: "Cuotas Atras.", key: "Cuotas Atrasadas" }
    ];

    let filasHTML = "";
    CAMPOS_POPUP.forEach(campo => {
        let valor = obtenerValorSeguro(p, campo.key);
        if (valor === null || valor === undefined || valor === "") valor = "-";
        if (campo.formato === "moneda" && valor !== "-") {
            valor = "$ " + valor;
        }
        filasHTML += `<tr><td>${campo.label}</td><td>${valor}</td></tr>`;
    });
    
    const contenidoPopup = `<table class="popup-table">${filasHTML}</table>`;
    
    // Configuración robusta del Popup
    layer.bindPopup(contenidoPopup, {
        maxWidth: 300,
        minWidth: 300,        // Fuerza el ancho fijo para evitar saltos
        maxHeight: 320,
        autoPan: true,        // Mueve el mapa para que entre el popup
        autoPanPadding: [50, 50], // Deja margen con el borde de la pantalla
        closeButton: true
    }).openPopup();

    // Actualizar panel lateral resumen
    const tgi = obtenerValorSeguro(p, "TGI");
    const titular = obtenerValorSeguro(p, "Tit. Nombre");
    document.getElementById('info-seleccionada').innerHTML = `
        <strong>Selección:</strong><br>
        Titular: ${titular} <br>
        TGI: ${tgi}`;
}

// --- 6. CARGA DE DATOS ---
const divCarga = document.getElementById('loading');

async function cargarCapas() {
    divCarga.style.display = 'block';
    try {
        const resSecc = await fetch('sections.geojson');
        if (resSecc.ok) {
            const dataSecc = await resSecc.json();
            generarLeyendaSecciones(dataSecc);
            
            capaSecciones = L.geoJSON(dataSecc, {
                renderer: renderizador,
                style: function(feature) {
                    const col = nombreColumnaSeccionGlobal || Object.keys(feature.properties).find(k => k.toUpperCase().includes("SECCION"));
                    const nombre = feature.properties[col];
                    return {
                        color: "white", weight: 1,
                        fillColor: obtenerColorSeccion(nombre), 
                        fillOpacity: 0.4,
                        renderer: renderizador
                    };
                },
                interactive: false
            }).addTo(map);
            capaSecciones.bringToBack();
        }

        const resParc = await fetch('parcels.geojson');
        if (resParc.ok) {
            const dataParc = await resParc.json();
            capaParcelas = L.geoJSON(dataParc, {
                style: ESTILOS.parcela,
                smoothFactor: 1.5,
                onEachFeature: function(feature, layer) {
                    layer.on({
                        click: () => seleccionarParcela(layer),
                        mouseover: () => { if(layer !== parcelaSeleccionadaLayer) layer.setStyle(ESTILOS.parcelaHover); },
                        mouseout: () => { if(layer !== parcelaSeleccionadaLayer) capaParcelas.resetStyle(layer); }
                    });
                }
            }).addTo(map);
        }
    } catch (e) {
        console.error(e);
        alert("Error cargando archivos.");
    } finally {
        divCarga.style.display = 'none';
    }
}

cargarCapas();

// --- 7. BÚSQUEDA ---
const inputBusqueda = document.getElementById('searchInput');
inputBusqueda.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarParcela(inputBusqueda.value); });

function buscarParcela(texto) {
    if (!capaParcelas) return;
    const term = texto.trim().toLowerCase();
    if (!term) return;
    let found = false;
    capaParcelas.eachLayer(layer => {
        if (found) return;
        const p = layer.feature.properties;
        const tgi = String(obtenerValorSeguro(p, "TGI")).toLowerCase();
        const part = String(obtenerValorSeguro(p, "PARTIDA")).toLowerCase();
        const tit = String(obtenerValorSeguro(p, "Tit. Nombre")).toLowerCase();
        
        if (tgi.includes(term) || part.includes(term) || tit.includes(term)) {
            seleccionarParcela(layer);
            found = true;
        }
    });
    if (!found) alert("No encontrado (Busque por TGI, Partida o Titular).");
}

document.getElementById('toggleParcels').addEventListener('change', (e) => {
    if(capaParcelas) e.target.checked ? map.addLayer(capaParcelas) : map.removeLayer(capaParcelas);
});

const btnMin = document.getElementById('minimize-btn');
const panelContent = document.getElementById('panel-content');
let panelVisible = true;
btnMin.addEventListener('click', () => {
    panelVisible = !panelVisible;
    panelContent.style.display = panelVisible ? 'block' : 'none';
    btnMin.textContent = panelVisible ? '-' : '+';
});
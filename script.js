// --- 1. CONFIGURACIÓN ---
const VISTA_INICIAL = { lat: -34.266, lng: -62.712, zoom: 14 };

// Paleta de colores para las secciones
const PALETA_SECCIONES = [
    "#8e44ad", "#2980b9", "#27ae60", "#16a085", 
    "#f39c12", "#d35400", "#c0392b", "#2c3e50",
    "#7f8c8d", "#e84393", "#00cec9", "#6c5ce7"
];

// --- OPTIMIZACIÓN DE RENDIMIENTO (NUEVO) ---
// Usamos 'Canvas' en lugar de SVG. Esto permite manejar miles de lotes sin que se trabe el zoom.
const renderizador = L.canvas({ padding: 0.5 });

const ESTILOS = {
    parcela: { 
        color: "#555", 
        weight: 1, 
        fillColor: "#ecf0f1", 
        fillOpacity: 0.05,
        renderer: renderizador // Aplicamos la optimización aquí
    },
    parcelaHover: { 
        color: "#e67e22", 
        weight: 2, 
        fillColor: "#f39c12", 
        fillOpacity: 0.7,
        renderer: renderizador
    },
    parcelaSeleccionada: { 
        color: "#c0392b", 
        weight: 3, 
        fillColor: "#e74c3c", 
        fillOpacity: 0.8,
        renderer: renderizador
    }
};

// --- 2. AYUDAS PARA DATOS ---

// Función segura para obtener datos (TGI, Partida, etc)
function obtenerValorSeguro(propiedades, busqueda) {
    if (!propiedades) return '-';
    const clave = Object.keys(propiedades).find(k => k.toUpperCase().includes(busqueda));
    return clave ? propiedades[clave] : '-';
}

// Función para obtener color de sección
function getColorSeccion(idSeccion) {
    if (!idSeccion) return "#95a5a6"; 
    let hash = 0;
    const str = String(idSeccion);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PALETA_SECCIONES.length;
    return PALETA_SECCIONES[index];
}

// --- 3. INICIAR MAPA ---
// preferCanvas: true fuerza al mapa a usar el modo rápido desde el inicio
const map = L.map('map', { 
    zoomControl: false,
    preferCanvas: true 
}).setView([VISTA_INICIAL.lat, VISTA_INICIAL.lng], VISTA_INICIAL.zoom);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let capaParcelas = null;
let capaSecciones = null;
let parcelaSeleccionadaLayer = null; 

// --- 4. FUNCIONES DE INTERACCIÓN ---

function seleccionarParcela(layer) {
    if (parcelaSeleccionadaLayer && capaParcelas) {
        capaParcelas.resetStyle(parcelaSeleccionadaLayer);
    }

    parcelaSeleccionadaLayer = layer;
    layer.setStyle(ESTILOS.parcelaSeleccionada);
    layer.bringToFront();

    map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 18 });
    
    const props = layer.feature.properties;
    const tgi = obtenerValorSeguro(props, "TGI");
    const partida = obtenerValorSeguro(props, "PARTIDA");
    const seccion = obtenerValorSeguro(props, "SECCION");
    const manzana = obtenerValorSeguro(props, "MANZ");
    const zona = obtenerValorSeguro(props, "ZONA");

    const contenidoPopup = `
        <table class="popup-table">
            <tr><td>Partida</td><td>${partida}</td></tr>
            <tr><td>TGI</td><td><strong>${tgi}</strong></td></tr>
            <tr><td>Sección</td><td>${seccion}</td></tr>
            <tr><td>Manzana</td><td>${manzana}</td></tr>
            <tr><td>Zona</td><td>${zona}</td></tr>
        </table>
    `;

    layer.bindPopup(contenidoPopup).openPopup();
    
    document.getElementById('info-seleccionada').innerHTML = `
        <strong>Lote Seleccionado:</strong><br>
        TGI: ${tgi} <br> Partida: ${partida}
    `;
}

// --- 5. CARGA DE DATOS ---
const divCarga = document.getElementById('loading');

async function cargarCapas() {
    divCarga.style.display = 'block';

    try {
        // A. Cargar Secciones
        const resSecc = await fetch('sections.geojson');
        if (resSecc.ok) {
            const dataSecc = await resSecc.json();
            capaSecciones = L.geoJSON(dataSecc, {
                // Optimización también para secciones
                renderer: renderizador,
                style: function(feature) {
                    const idSec = obtenerValorSeguro(feature.properties, "SECCION");
                    return {
                        color: "white",        
                        weight: 1,
                        fillColor: getColorSeccion(idSec), 
                        fillOpacity: 0.4,
                        renderer: renderizador // Importante para rendimiento
                    };
                },
                interactive: false
            }).addTo(map);
            capaSecciones.bringToBack(); 
        }

        // B. Cargar Parcelas
        const resParc = await fetch('parcels.geojson');
        if (!resParc.ok) throw new Error("No se encontró parcels.geojson");
        const dataParc = await resParc.json();

        capaParcelas = L.geoJSON(dataParc, {
            style: ESTILOS.parcela,
            // smoothFactor simplifica líneas imperceptibles al alejar el zoom para ganar velocidad
            smoothFactor: 1.5, 
            onEachFeature: function(feature, layer) {
                layer.on({
                    click: function(e) {
                        seleccionarParcela(layer);
                    },
                    mouseover: function(e) {
                        if (layer !== parcelaSeleccionadaLayer) {
                            layer.setStyle(ESTILOS.parcelaHover);
                        }
                    },
                    mouseout: function(e) {
                        if (layer !== parcelaSeleccionadaLayer) {
                            capaParcelas.resetStyle(layer);
                        }
                    }
                });
            }
        }).addTo(map);

    } catch (e) {
        console.error(e);
        alert("Error cargando datos.");
    } finally {
        divCarga.style.display = 'none';
    }
}

cargarCapas();

// --- 6. BÚSQUEDA ---
const inputBusqueda = document.getElementById('searchInput');

inputBusqueda.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') buscarParcela(inputBusqueda.value);
});

inputBusqueda.addEventListener('input', (e) => {
    if (inputBusqueda.value === "") {
        if (parcelaSeleccionadaLayer && capaParcelas) {
            capaParcelas.resetStyle(parcelaSeleccionadaLayer);
            parcelaSeleccionadaLayer = null;
            map.closePopup();
        }
    }
});

function buscarParcela(texto) {
    if (!capaParcelas) return;
    
    const termino = texto.trim().toLowerCase();
    if (!termino) return;

    let encontrado = false;

    capaParcelas.eachLayer((layer) => {
        if (encontrado) return;
        
        const p = layer.feature.properties;
        const tgiVal = String(obtenerValorSeguro(p, "TGI")).toLowerCase();
        const partVal = String(obtenerValorSeguro(p, "PARTIDA")).toLowerCase();

        if (tgiVal.includes(termino) || partVal.includes(termino)) {
            seleccionarParcela(layer);
            encontrado = true;
        }
    });

    if (!encontrado) {
        alert("No se encontró ninguna parcela con ese TGI o Partida.");
    }
}

// --- 7. CONTROLES DEL PANEL ---
document.getElementById('toggleParcels').addEventListener('change', (e) => {
    if(capaParcelas) e.target.checked ? map.addLayer(capaParcelas) : map.removeLayer(capaParcelas);
});

document.getElementById('toggleSections').addEventListener('change', (e) => {
    if(capaSecciones) e.target.checked ? map.addLayer(capaSecciones) : map.removeLayer(capaSecciones);
});

const btnMin = document.getElementById('minimize-btn');
const panelContent = document.getElementById('panel-content');
let panelVisible = true;

btnMin.addEventListener('click', () => {
    panelVisible = !panelVisible;
    panelContent.style.display = panelVisible ? 'block' : 'none';
    btnMin.textContent = panelVisible ? '-' : '+';
});

// ==========================================
// MEDICTRACE V2 - CONEXIÓN BLOCKCHAIN
// ==========================================

const DIRECCION_CONTRATO_V2 =
    "0x7C597756835F52D2F838Bd7a846FEe3dF119477A";

let proveedor = null;
let firmante = null;
let contrato = null;
let direccionUsuario = null;

if (window.ethereum) {
    window.ethereum.on("accountsChanged", function(cuentas) {
        if (cuentas.length > 0) {
            conectarMetaMask();
        } else {
            contrato = null;
            firmante = null;
            direccionUsuario = null;

            document.getElementById("estadoConexion").textContent =
                "Billetera no conectada";

            document.getElementById("rolUsuario").textContent =
                "Rol: No identificado";

            actualizarEtapasPorRol(0);
            actualizarInterfazPorRol(0);
        }
    });
}

// Cargar ABI del contrato V2
async function cargarABI() {
    const respuesta = await fetch("./RegistroMedicamentosV2ABI.json");

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar el ABI de MedicTrace V2.");
    }

    return await respuesta.json();
}

// Conectar con MetaMask
async function conectarMetaMask() {
    try {
        if (!window.ethereum) {
            throw new Error("MetaMask no está instalado en el navegador.");
        }

        const cuentas = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        proveedor = new ethers.BrowserProvider(window.ethereum);

        const red = await proveedor.getNetwork();

        if (Number(red.chainId) !== 11155111) {
            throw new Error("Cambia la red de MetaMask a Sepolia.");
        }

        firmante = await proveedor.getSigner();
        direccionUsuario = cuentas[0];

        const ABI = await cargarABI();

        contrato = new ethers.Contract(
            DIRECCION_CONTRATO_V2,
            ABI,
            firmante
        );

        document.getElementById("estadoConexion").textContent =
            "Conectado: " + direccionUsuario;

        const rol = await contrato.consultarRol(direccionUsuario);

const rolActual = Number(rol);
console.log("Rol del participante:", rolActual);
actualizarEtapasPorRol(rolActual);
actualizarInterfazPorRol(rolActual);
        const nombresRoles = [
            "Ninguno",
            "Administrador",
            "Laboratorio",
            "Distribuidor",
            "Farmacia",
            "Regulador"
        ];

        document.getElementById("rolUsuario").textContent =
            "Rol: " + (nombresRoles[Number(rol)] || "Desconocido");

    } catch (error) {
        console.error(error);

        document.getElementById("estadoConexion").textContent =
            "Error: " + (error.shortMessage || error.message);
    }
}

// Botón de conexión
document.getElementById("btnConectar")
    .addEventListener("click", conectarMetaMask);



// ==========================================
// REGISTRAR MEDICAMENTO
// ==========================================

async function registrarMedicamento() {
    const mensaje = document.getElementById("mensajeRegistro");

    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const gtin = document.getElementById("gtin").value.trim();
        const lote = document.getElementById("lote").value.trim();
        const serie = document.getElementById("serie").value.trim();
        const vencimiento = document.getElementById("vencimiento").value;

        if (!/^[0-9]{14}$/.test(gtin)) {
            throw new Error("El GTIN debe tener exactamente 14 dígitos.");
        }

        if (!lote || !serie || !vencimiento) {
            throw new Error("Completa todos los campos.");
        }

        const fecha = new Date(vencimiento + "T00:00:00Z");
        const fechaUnix = Math.floor(fecha.getTime() / 1000);

        if (!Number.isFinite(fechaUnix) || fechaUnix <= Math.floor(Date.now() / 1000)) {
            throw new Error("La fecha de vencimiento debe ser futura.");
        }

        mensaje.textContent = "Esperando confirmación en MetaMask...";

        const transaccion = await contrato.registrarMedicamento(
            gtin,
            lote,
            serie,
            fechaUnix
        );

        mensaje.textContent = "Transacción enviada. Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent = "¡Medicamento registrado correctamente!";

    } catch (error) {
        console.error(error);
        mensaje.textContent =
            "Error: " + (error.shortMessage || error.reason || error.message);
    }
}

// ==========================================
// CONSULTAR MEDICAMENTO E HISTORIAL
// ==========================================


async function consultarMedicamento() {
    const resultado = document.getElementById("resultadoConsulta");
    const historialDiv = document.getElementById("historialTrazabilidad");

    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const gtin = document.getElementById("gtinConsulta").value.trim();
        const serie = document.getElementById("serieConsulta").value.trim();

        if (!/^[0-9]{14}$/.test(gtin) || !serie) {
            throw new Error("Ingresa un GTIN de 14 dígitos y un número de serie.");
        }

        resultado.textContent = "Consultando...";
        historialDiv.innerHTML = "";



        const medicamento = await contrato.consultarMedicamento(gtin, serie);

        console.log("Medicamento recibido:", medicamento.toArray());

        // Leer los datos mediante sus posiciones
        const gtinGuardado = medicamento[0];
        const loteGuardado = medicamento[1];
        const serieGuardada = medicamento[2];
        const vencimientoGuardado = medicamento[3];
        const registrado = medicamento[4];

        if (!registrado) {
            resultado.textContent = "No se encontró el medicamento.";
            return;
        }

        const fechaVencimiento = new Date(
            Number(vencimientoGuardado) * 1000
        ).toLocaleDateString("es-PE", { timeZone: "UTC" });

        
resultado.innerHTML = `
    <div class="ficha-medicamento">
        <div class="ficha-encabezado">
            <h3>Información del medicamento</h3>
            <span class="estado-medicamento">
                Registrado
            </span>
        </div>

        <div class="datos-medicamento">
            <div class="dato-medicamento">
                <span>GTIN</span>
                <strong>${gtinGuardado}</strong>
            </div>

            <div class="dato-medicamento">
                <span>Número de serie</span>
                <strong>${serieGuardada}</strong>
            </div>

            <div class="dato-medicamento">
                <span>Número de lote</span>
                <strong>${loteGuardado}</strong>
            </div>

            <div class="dato-medicamento">
                <span>Fecha de vencimiento</span>
                <strong>${fechaVencimiento}</strong>
            </div>
        </div>
    </div>
`;

        const eventos = await contrato.consultarHistorial(gtin, serie);

        const nombresEtapas = [
            "Fabricación",
            "Despacho al distribuidor",
            "Recepción del distribuidor",
            "Despacho a farmacia",
            "Recepción en farmacia"
        ];

        historialDiv.innerHTML = "";

        if (eventos.length === 0) {
            historialDiv.innerHTML += "<p>Aún no hay etapas registradas.</p>";
            return;
        }

        
eventos.forEach((evento, indice) => {
    const fechaEvento = new Date(
        Number(evento[2]) * 1000
    ).toLocaleString("es-PE");

    const articulo = document.createElement("article");

    articulo.className = "evento-timeline";

    articulo.innerHTML = `
        <div class="evento-contenido">
            <div class="evento-encabezado">
                <span class="numero-etapa">${indice + 1}</span>
                <h4>${nombresEtapas[Number(evento[0])] || "Etapa desconocida"}</h4>
                <span class="estado-etapa">Registrada</span>
            </div>

            <div class="evento-detalles">
                <p><strong>Ubicación:</strong> ${evento[3]}</p>
                <p><strong>Referencia:</strong> ${evento[4]}</p>
                <p><strong>Responsable:</strong> ${evento[1]}</p>
                <p><strong>Fecha:</strong> ${fechaEvento}</p>
            </div>
        </div>
    `;

    historialDiv.appendChild(articulo);
});


    } catch (error) {
        console.error(error);

        resultado.textContent =
            "Error: " + (error.shortMessage || error.reason || error.message);
    }
}


// ==========================================
// CONECTAR LOS BOTONES
// ==========================================

document.getElementById("btnRegistrarMedicamento")
    .addEventListener("click", registrarMedicamento);

document.getElementById("btnConsultar")
    .addEventListener("click", consultarMedicamento);


    async function registrarEtapa() {
    const mensaje = document.getElementById("mensajeEtapa");

    try {
        if (!contrato) {
            mensaje.textContent = "Primero debes conectar MetaMask.";
            return;
        }

        const gtin = document.getElementById("gtinEtapa").value.trim();
        const serie = document.getElementById("serieEtapa").value.trim();
        const etapa = Number(document.getElementById("etapa").value);
        const ubicacion = document.getElementById("ubicacionEtapa").value.trim();
        const referencia = document.getElementById("referenciaEtapa").value.trim();

        if (!/^\d{14}$/.test(gtin)) {
            mensaje.textContent = "El GTIN debe tener exactamente 14 dígitos.";
            return;
        }

        if (!serie || !ubicacion || !referencia) {
            mensaje.textContent = "Completa todos los campos.";
            return;
        }

        const siguiente = await consultarSiguienteEtapa(gtin, serie);

if (!siguiente) {
    mensaje.textContent = "No se pudo validar el recorrido.";
    return;
}

if (siguiente.completado) {
    mensaje.textContent = "El recorrido ya está completo.";
    return;
}

if (siguiente.numero !== etapa) {
    mensaje.textContent =
        "Etapa incorrecta. La siguiente etapa es: " + siguiente.nombre;
    return;
}

const rolNecesarioPorEtapa = {
    0: 2, // Fabricación: Laboratorio
    1: 2, // Despacho al distribuidor: Laboratorio
    2: 3, // Recepción del distribuidor: Distribuidor
    3: 3, // Despacho a farmacia: Distribuidor
    4: 4  // Recepción en farmacia: Farmacia
};

const rolUsuario = Number(
    await contrato.consultarRol(direccionUsuario)
);

if (rolUsuario !== rolNecesarioPorEtapa[etapa]) {
    mensaje.textContent =
        "No tienes permisos para registrar esta etapa.";
    return;
}

        mensaje.textContent = "Esperando confirmación en MetaMask...";

        const transaccion = await contrato.registrarEtapa(
            gtin,
            serie,
            etapa,
            ubicacion,
            referencia
        );

        mensaje.textContent = "Transacción enviada. Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent = "¡Etapa registrada correctamente en Sepolia!";
    } catch (error) {
        console.error("Error al registrar etapa:", error);

        mensaje.textContent =
            error.reason ||
            error.shortMessage ||
            "No se pudo registrar la etapa. Revisa los permisos y el orden del recorrido.";
    }
}

document.getElementById("btnRegistrarEtapa")
    .addEventListener("click", registrarEtapa);

document.getElementById("btnConsultarSiguiente")
    .addEventListener("click", mostrarSiguienteEtapa);

function actualizarEtapasPorRol(rol) {
    const selector = document.getElementById("etapa");

    selector.innerHTML = "";

    const etapasPorRol = {
        2: [
            { valor: 0, nombre: "Fabricación" },
            { valor: 1, nombre: "Despacho al distribuidor" }
        ],
        3: [
            { valor: 2, nombre: "Recepción del distribuidor" },
            { valor: 3, nombre: "Despacho a farmacia" }
        ],
        4: [
            { valor: 4, nombre: "Recepción en farmacia" }
        ]
    };

    const etapas = etapasPorRol[rol] || [];

    if (etapas.length === 0) {
        const opcion = document.createElement("option");
        opcion.textContent = "No tienes etapas asignadas";
        opcion.value = "";
        selector.appendChild(opcion);
        selector.disabled = true;
        return;
    }

    selector.disabled = false;

    etapas.forEach(function(etapa) {
        const opcion = document.createElement("option");
        opcion.value = etapa.valor;
        opcion.textContent = etapa.nombre;
        selector.appendChild(opcion);
    });
}

function actualizarInterfazPorRol(rol) {
    const seccionAdministracion = document.getElementById("seccionAdministracion");

    seccionAdministracion.style.display =
        Number(rol) === 1 ? "" : "none";
    const seccionMedicamentos = document.getElementById("seccionRegistroMedicamentos");
    const seccionEtapas = document.getElementById("seccionRegistroEtapas");

    // Solo el laboratorio puede registrar medicamentos.
    seccionMedicamentos.style.display =
        Number(rol) === 2 ? "" : "none";

    // Laboratorio, distribuidor y farmacia pueden registrar sus etapas.
    seccionEtapas.style.display =
        [2, 3, 4].includes(Number(rol)) ? "" : "none";
}

async function registrarNuevoParticipante() {
    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const direccion = document.getElementById("direccionParticipante").value.trim();
        const rol = Number(document.getElementById("rolParticipante").value);
        const mensaje = document.getElementById("mensajeAdministracion");

        if (!ethers.isAddress(direccion)) {
            throw new Error("La dirección de la billetera no es válida.");
        }

        mensaje.textContent = "Enviando transacción a Sepolia...";

        const transaccion = await contrato.registrarParticipante(direccion, rol);

        mensaje.textContent = "Esperando confirmación...";
        await transaccion.wait();

        mensaje.textContent = "¡Participante registrado correctamente!";
    } catch (error) {
        console.error(error);

        document.getElementById("mensajeAdministracion").textContent =
            "Error: " + (error.shortMessage || error.message);
    }
}

async function cambiarRolParticipante() {
    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const direccion = document.getElementById("direccionParticipante").value.trim();
        const rol = Number(document.getElementById("rolParticipante").value);
        const mensaje = document.getElementById("mensajeAdministracion");

        if (!ethers.isAddress(direccion)) {
            throw new Error("La dirección de la billetera no es válida.");
        }

        mensaje.textContent = "Enviando cambio de rol a Sepolia...";

        const transaccion = await contrato.cambiarRol(direccion, rol);

        mensaje.textContent = "Esperando confirmación...";
        await transaccion.wait();

        mensaje.textContent = "¡Rol actualizado correctamente!";
    } catch (error) {
        console.error(error);

        document.getElementById("mensajeAdministracion").textContent =
            "Error: " + (error.shortMessage || error.message);
    }
}

async function consultarRolParticipante() {
    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const direccion = document.getElementById("direccionParticipante").value.trim();
        const mensaje = document.getElementById("mensajeAdministracion");

        if (!ethers.isAddress(direccion)) {
            throw new Error("La dirección de la billetera no es válida.");
        }

        const rol = await contrato.consultarRol(direccion);

        const nombresRoles = [
            "Ninguno",
            "Administrador",
            "Laboratorio",
            "Distribuidor",
            "Farmacia",
            "Regulador"
        ];

        mensaje.textContent =
            "Rol del participante: " + nombresRoles[Number(rol)];

    } catch (error) {
        console.error(error);

        document.getElementById("mensajeAdministracion").textContent =
            "Error: " + (error.shortMessage || error.message);
    }
}

async function desactivarParticipante() {
    try {
        if (!contrato) {
            throw new Error("Primero debes conectar MetaMask.");
        }

        const direccion = document.getElementById("direccionParticipante").value.trim();
        const mensaje = document.getElementById("mensajeAdministracion");

        if (!ethers.isAddress(direccion)) {
            throw new Error("La dirección de la billetera no es válida.");
        }

        mensaje.textContent = "Enviando solicitud a Sepolia...";

        const transaccion = await contrato.desactivarParticipante(direccion);

        mensaje.textContent = "Esperando confirmación...";
        await transaccion.wait();

        mensaje.textContent = "¡Participante desactivado correctamente!";
    } catch (error) {
        console.error(error);

        document.getElementById("mensajeAdministracion").textContent =
            "Error: " + (error.shortMessage || error.message);
    }
}

async function consultarSiguienteEtapa(gtin, serie) {
    try {
        const eventos = await contrato.consultarHistorial(gtin, serie);

        const totalEtapas = eventos.length;

        const nombresEtapas = [
            "Fabricación",
            "Despacho al distribuidor",
            "Recepción del distribuidor",
            "Despacho a farmacia",
            "Recepción en farmacia"
        ];

        if (totalEtapas >= 5) {
            return {
                completado: true,
                mensaje: "El recorrido del medicamento está completo."
            };
        }

        return {
            completado: false,
            numero: totalEtapas,
            nombre: nombresEtapas[totalEtapas]
        };

    } catch (error) {
        console.error("Error al consultar la siguiente etapa:", error);

        return null;
    }
}

async function mostrarSiguienteEtapa() {
    const mensaje = document.getElementById("siguienteEtapa");

    try {
        if (!contrato) {
            mensaje.textContent = "Primero conecta MetaMask.";
            return;
        }

        const gtin = document.getElementById("gtinEtapa").value.trim();
        const serie = document.getElementById("serieEtapa").value.trim();

        if (!/^\d{14}$/.test(gtin) || !serie) {
            mensaje.textContent = "Ingresa un GTIN válido y un número de serie.";
            return;
        }

        mensaje.textContent = "Consultando recorrido en Blockchain...";

        const siguiente = await consultarSiguienteEtapa(gtin, serie);

        if (!siguiente) {
            mensaje.textContent = "No se pudo consultar el historial.";
            return;
        }

        if (siguiente.completado) {
            mensaje.textContent = siguiente.mensaje;
            return;
        }

        mensaje.textContent =
            "Siguiente etapa: " + siguiente.nombre;

    } catch (error) {
        console.error(error);
        mensaje.textContent = "Ocurrió un error al consultar el recorrido.";
    }
}

// =====================================
// CONSTRUIR ENLACE GS1 DIGITAL LINK
// =====================================

function construirGS1DigitalLink(gtin, serie) {

    if (!/^\d{14}$/.test(gtin)) {
        throw new Error("El GTIN debe tener exactamente 14 dígitos.");
    }

    if (!serie || !serie.trim()) {
        throw new Error("El número de serie es obligatorio.");
    }

    const serieCodificada = encodeURIComponent(serie.trim());

    const enlace =
        `https://id.gs1.org/01/${gtin}/21/${serieCodificada}`;

    return enlace;
}

console.log(
    "Prueba GS1 Digital Link:",
    construirGS1DigitalLink(
        "07712345678905",
        "SERIE0001"
    )
);

// =====================================
// GENERAR GS1 DESDE LA INTERFAZ
// =====================================

document.getElementById("btnGenerarGS1")
    .addEventListener("click", function() {

        const gtin = document.getElementById("gtinGS1").value.trim();
        const serie = document.getElementById("serieGS1").value.trim();

        const resultado = document.getElementById("resultadoGS1");

        try {
            const enlace = construirGS1DigitalLink(gtin, serie);

resultado.innerHTML = `
    <strong>Enlace GS1 generado:</strong><br>
    <a href="${enlace}" target="_blank" rel="noopener noreferrer">
        ${enlace}
    </a>
`;

// Limpiar el QR anterior
const contenedorQR = document.getElementById("codigoQR");
contenedorQR.innerHTML = "";

// Generar nuevo código QR
new QRCode(contenedorQR, {
    text: enlace,
    width: 200,
    height: 200,
    correctLevel: QRCode.CorrectLevel.H
});

        } catch (error) {
            resultado.textContent = error.message;
        }
    });

    // =====================================
// LECTOR DE CODIGOS QR
// =====================================

let lectorQR = null;

async function iniciarEscaneoQR() {

    const resultado = document.getElementById("resultadoEscaneo");

    try {

        if (typeof Html5Qrcode === "undefined") {
            resultado.textContent =
                "No se pudo cargar la biblioteca de lectura QR.";
            return;
        }

        lectorQR = new Html5Qrcode("lectorQR");

        resultado.textContent = "Iniciando cámara...";

        await lectorQR.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 220, height: 220 }
            },

            async function (textoQR) {

                try {

                    const url = new URL(textoQR);

                    if (url.hostname !== "id.gs1.org") {
                        throw new Error("El QR no contiene un enlace GS1 válido.");
                    }

                    const coincidencia = url.pathname.match(
                        /^\/01\/(\d{14})\/21\/([^/]+)\/?$/
                    );

                    if (!coincidencia) {
                        throw new Error("El enlace GS1 no tiene el formato esperado.");
                    }

                    const gtin = coincidencia[1];
                    const serie = decodeURIComponent(coincidencia[2]);

                    document.getElementById("gtinConsulta").value = gtin;
                    document.getElementById("serieConsulta").value = serie;

                    document.getElementById("gtinGS1").value = gtin;
                    document.getElementById("serieGS1").value = serie;

                    resultado.textContent =
                        "QR leído correctamente. Consultando medicamento...";

                    await lectorQR.stop();

                    lectorQR.clear();
                    lectorQR = null;

            await consultarMedicamento();

            resultado.textContent =
                "¡Medicamento e historial consultados correctamente!";
                    
                } catch (error) {

                    resultado.textContent = error.message;

                }

            }
        );

        resultado.textContent = "Cámara activa. Enfoca el código QR.";

    } catch (error) {

        console.error("Error al iniciar el lector QR:", error);

        resultado.textContent =
            "No se pudo iniciar la cámara. Revisa los permisos del navegador.";
    }
}

document.getElementById("btnIniciarEscaneo")
    .addEventListener("click", iniciarEscaneoQR);

document.getElementById("btnRegistrarParticipante")
    .addEventListener("click", registrarNuevoParticipante);

document.getElementById("btnCambiarRol")
    .addEventListener("click", cambiarRolParticipante);

document.getElementById("btnDesactivarParticipante")
    .addEventListener("click", desactivarParticipante);

document.getElementById("btnConsultarRol")
    .addEventListener("click", consultarRolParticipante);
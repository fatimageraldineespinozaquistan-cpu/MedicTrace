// ==========================================
// MEDICTRACE V3 - CONEXIÓN BLOCKCHAIN
// ==========================================

const DIRECCION_CONTRATO_V3 =
    "0x7C597756835F52D2F838Bd7a846FEe3dF119477A";

let proveedor = null;
let firmante = null;
let contrato = null;
let direccionUsuario = null;
let lectorQR = null;

const NOMBRES_ROLES = [
    "Sin rol",
    "Administrador",
    "Laboratorio",
    "Distribuidor",
    "Farmacia",
    "Regulador"
];

const NOMBRES_ETAPAS = [
    "Fabricación",
    "Despacho al distribuidor",
    "Recepción del distribuidor",
    "Despacho a farmacia",
    "Recepción en farmacia"
];


// ==========================================
// UTILIDADES
// ==========================================

function obtenerMensajeError(error) {
    return error.shortMessage ||
        error.reason ||
        error.message ||
        "Ocurrió un error inesperado.";
}

function mostrarMensaje(id, texto) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = texto;
    }
}

function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);

    if (clase) {
        elemento.className = clase;
    }

    if (texto !== undefined && texto !== null) {
        elemento.textContent = String(texto);
    }

    return elemento;
}

function convertirFecha(timestamp) {
    return new Date(
        Number(timestamp) * 1000
    ).toLocaleString("es-PE");
}


// ==========================================
// DASHBOARD
// ==========================================

function actualizarDashboardConexion(direccion, rol) {
    mostrarMensaje("dashboardConexion", "Conectado");

    mostrarMensaje(
        "dashboardDireccion",
        direccion.slice(0, 6) + "..." + direccion.slice(-4)
    );

    mostrarMensaje(
        "dashboardRol",
        NOMBRES_ROLES[rol] || "Desconocido"
    );
}

function actualizarDashboardDesconexion() {
    mostrarMensaje("dashboardConexion", "Desconectado");
    mostrarMensaje("dashboardDireccion", "Conecta tu billetera");
    mostrarMensaje("dashboardRol", "No identificado");
}

function limpiarDashboardMedicamento() {
    mostrarMensaje("dashboardMedicamento", "Sin consulta");

    mostrarMensaje(
        "dashboardLote",
        "Consulta un medicamento"
    );

    actualizarDashboardTrazabilidad([]);
}

function actualizarDashboardMedicamento(gtin, lote, serie) {
    mostrarMensaje("dashboardMedicamento", gtin);

    mostrarMensaje(
        "dashboardLote",
        "Lote: " + lote + " | Serie: " + serie
    );
}

function actualizarDashboardTrazabilidad(eventos) {
    const cantidad = Math.min(eventos.length, 5);
    const porcentaje = Math.round((cantidad / 5) * 100);

    mostrarMensaje(
        "dashboardEtapas",
        cantidad + " de 5"
    );

    mostrarMensaje(
        "dashboardPorcentaje",
        porcentaje + "%"
    );

    document.getElementById(
        "dashboardBarraProgreso"
    ).style.width = porcentaje + "%";

    mostrarMensaje(
        "dashboardEstado",
        cantidad === 5
            ? "Recorrido completo"
            : cantidad === 0
                ? "Sin etapas registradas"
                : "Recorrido en proceso"
    );

    const actividad = document.getElementById(
        "dashboardActividad"
    );

    actividad.replaceChildren();

    if (cantidad === 0) {
        actividad.appendChild(
            crearElemento(
                "p",
                "",
                "Aún no hay actividad para mostrar."
            )
        );

        return;
    }

    // IMPORTANTE:
    // No usamos reverse() directamente sobre el resultado de Ethers.
    // Recorremos los últimos eventos mediante sus índices.

    const inicio = Math.max(0, eventos.length - 3);

    for (let i = eventos.length - 1; i >= inicio; i--) {
        const evento = eventos[i];

        const tarjeta = crearElemento(
            "div",
            "dashboard-evento"
        );

        const titulo = crearElemento(
            "strong",
            "",
            NOMBRES_ETAPAS[Number(evento[0])] ||
            "Etapa desconocida"
        );

        const detalle = crearElemento(
            "span",
            "",
            "Ubicación: " + evento[3]
        );

        const fecha = crearElemento(
            "span",
            "",
            convertirFecha(evento[2])
        );

        tarjeta.appendChild(titulo);
        tarjeta.appendChild(detalle);
        tarjeta.appendChild(fecha);

        actividad.appendChild(tarjeta);
    }
}


// ==========================================
// CAMBIO DE CUENTA EN METAMASK
// ==========================================

if (window.ethereum) {
    window.ethereum.on("accountsChanged", async function(cuentas) {
        if (cuentas.length > 0) {
            contrato = null;
            firmante = null;
            direccionUsuario = null;

            await conectarMetaMask();
        } else {
            contrato = null;
            firmante = null;
            proveedor = null;
            direccionUsuario = null;

            mostrarMensaje(
                "estadoConexion",
                "Billetera no conectada"
            );

            mostrarMensaje(
                "rolUsuario",
                "Rol: No identificado"
            );

            actualizarEtapasPorRol(0);
            actualizarInterfazPorRol(0);
            actualizarDashboardDesconexion();
            limpiarDashboardMedicamento();
        }
    });
}


// ==========================================
// CARGAR ABI
// ==========================================

async function cargarABI() {
    const respuesta = await fetch(
        "./RegistroMedicamentosV2ABI.json"
    );

    if (!respuesta.ok) {
        throw new Error(
            "No se pudo cargar RegistroMedicamentosV2ABI.json."
        );
    }

    return await respuesta.json();
}


// ==========================================
// CONECTAR METAMASK
// ==========================================

async function conectarMetaMask() {
    try {
        if (!window.ethereum) {
            throw new Error(
                "MetaMask no está instalado en el navegador."
            );
        }

        mostrarMensaje(
            "estadoConexion",
            "Conectando billetera..."
        );

        const cuentas = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!cuentas || cuentas.length === 0) {
            throw new Error("No se encontró una cuenta de MetaMask.");
        }

        proveedor = new ethers.BrowserProvider(
            window.ethereum
        );

        const red = await proveedor.getNetwork();

        if (Number(red.chainId) !== 11155111) {
            throw new Error(
                "Cambia la red de MetaMask a Sepolia."
            );
        }

        firmante = await proveedor.getSigner();

        direccionUsuario = await firmante.getAddress();

        const ABI = await cargarABI();

        contrato = new ethers.Contract(
            DIRECCION_CONTRATO_V3,
            ABI,
            firmante
        );

        const rol = await contrato.consultarRol(
            direccionUsuario
        );

        const rolActual = Number(rol);

        actualizarEtapasPorRol(rolActual);
        actualizarInterfazPorRol(rolActual);

        actualizarDashboardConexion(
            direccionUsuario,
            rolActual
        );

        mostrarMensaje(
            "estadoConexion",
            "Conectado: " + direccionUsuario
        );

        mostrarMensaje(
            "rolUsuario",
            "Rol: " + (NOMBRES_ROLES[rolActual] || "Desconocido")
        );

        console.log("MedicTrace V3 conectado.");
        console.log("Cuenta:", direccionUsuario);
        console.log("Rol:", rolActual);

    } catch (error) {
        console.error("Error de conexión:", error);

        contrato = null;
        firmante = null;

        mostrarMensaje(
            "estadoConexion",
            "Error: " + obtenerMensajeError(error)
        );

        actualizarDashboardDesconexion();
    }
}

document.getElementById("btnConectar")
    .addEventListener("click", conectarMetaMask);


// ==========================================
// REGISTRAR MEDICAMENTO
// ==========================================

async function registrarMedicamento() {
    const mensaje = document.getElementById(
        "mensajeRegistro"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const gtin = document.getElementById("gtin")
            .value.trim();

        const lote = document.getElementById("lote")
            .value.trim();

        const serie = document.getElementById("serie")
            .value.trim();

        const vencimiento = document.getElementById(
            "vencimiento"
        ).value;

        if (!/^[0-9]{14}$/.test(gtin)) {
            throw new Error(
                "El GTIN debe tener exactamente 14 dígitos."
            );
        }

        if (!lote || !serie || !vencimiento) {
            throw new Error(
                "Completa todos los campos."
            );
        }

        const fecha = new Date(
            vencimiento + "T00:00:00Z"
        );

        const fechaUnix = Math.floor(
            fecha.getTime() / 1000
        );

        if (
            !Number.isFinite(fechaUnix) ||
            fechaUnix <= Math.floor(Date.now() / 1000)
        ) {
            throw new Error(
                "La fecha de vencimiento debe ser futura."
            );
        }

        mensaje.textContent =
            "Esperando confirmación en MetaMask...";

        const transaccion = await contrato.registrarMedicamento(
            gtin,
            lote,
            serie,
            fechaUnix
        );

        mensaje.textContent =
            "Transacción enviada. Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent =
            "¡Medicamento registrado correctamente en Sepolia!";

        limpiarDashboardMedicamento();

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}

document.getElementById("btnRegistrarMedicamento")
    .addEventListener("click", registrarMedicamento);


// ==========================================
// CONSULTAR MEDICAMENTO E HISTORIAL
// ==========================================

async function consultarMedicamento() {
    const resultado = document.getElementById(
        "resultadoConsulta"
    );

    const historialDiv = document.getElementById(
        "historialTrazabilidad"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const gtin = document.getElementById(
            "gtinConsulta"
        ).value.trim();

        const serie = document.getElementById(
            "serieConsulta"
        ).value.trim();

        if (!/^[0-9]{14}$/.test(gtin) || !serie) {
            throw new Error(
                "Ingresa un GTIN de 14 dígitos y un número de serie."
            );
        }

        resultado.textContent = "Consultando medicamento...";
        historialDiv.replaceChildren();

        // Ethers devuelve un Result.
        // Leemos sus posiciones sin convertirlo ni modificarlo.

        const medicamento = await contrato.consultarMedicamento(
            gtin,
            serie
        );

        const gtinGuardado = medicamento[0];
        const loteGuardado = medicamento[1];
        const serieGuardada = medicamento[2];
        const vencimientoGuardado = medicamento[3];
        const registrado = medicamento[4];

        console.log(
            "Medicamento consultado correctamente:",
            String(gtinGuardado)
        );

        if (!registrado) {
            resultado.textContent =
                "No se encontró el medicamento.";

            historialDiv.appendChild(
                crearElemento(
                    "p",
                    "empty-state",
                    "No existen etapas registradas."
                )
            );

            limpiarDashboardMedicamento();

            return;
        }

        const fechaVencimiento = new Date(
            Number(vencimientoGuardado) * 1000
        ).toLocaleDateString(
            "es-PE",
            { timeZone: "UTC" }
        );

        actualizarDashboardMedicamento(
            gtinGuardado,
            loteGuardado,
            serieGuardada
        );

        // Crear ficha del medicamento sin insertar datos externos
        // mediante HTML dinámico.

        const ficha = crearElemento(
            "div",
            "ficha-medicamento"
        );

        const encabezado = crearElemento(
            "div",
            "ficha-encabezado"
        );

        encabezado.appendChild(
            crearElemento(
                "h3",
                "",
                "Información del medicamento"
            )
        );

        encabezado.appendChild(
            crearElemento(
                "span",
                "estado-medicamento",
                "Registrado"
            )
        );

        const datos = crearElemento(
            "div",
            "datos-medicamento"
        );

        const campos = [
            ["GTIN", gtinGuardado],
            ["Número de serie", serieGuardada],
            ["Número de lote", loteGuardado],
            ["Fecha de vencimiento", fechaVencimiento]
        ];

        campos.forEach(([etiqueta, valor]) => {
            const dato = crearElemento(
                "div",
                "dato-medicamento"
            );

            dato.appendChild(
                crearElemento("span", "", etiqueta)
            );

            dato.appendChild(
                crearElemento("strong", "", valor)
            );

            datos.appendChild(dato);
        });

        ficha.appendChild(encabezado);
        ficha.appendChild(datos);

        resultado.replaceChildren(ficha);

        // Consultar historial

        const eventos = await contrato.consultarHistorial(
            gtin,
            serie
        );

        actualizarDashboardTrazabilidad(eventos);

        historialDiv.replaceChildren();

        if (eventos.length === 0) {
            historialDiv.appendChild(
                crearElemento(
                    "p",
                    "empty-state",
                    "Aún no hay etapas registradas."
                )
            );

            return;
        }

        // Iteración por índice para no modificar el Result de Ethers.

        for (let i = 0; i < eventos.length; i++) {
            const evento = eventos[i];

            const articulo = crearElemento(
                "article",
                "evento-timeline"
            );

            const encabezadoEvento = crearElemento(
                "div",
                "evento-encabezado"
            );

            encabezadoEvento.appendChild(
                crearElemento(
                    "span",
                    "numero-etapa",
                    i + 1
                )
            );

            encabezadoEvento.appendChild(
                crearElemento(
                    "h4",
                    "",
                    NOMBRES_ETAPAS[Number(evento[0])] ||
                    "Etapa desconocida"
                )
            );

            encabezadoEvento.appendChild(
                crearElemento(
                    "span",
                    "estado-etapa",
                    "Registrada"
                )
            );

            const detalles = crearElemento(
                "div",
                "evento-detalles"
            );

            const datosEvento = [
                ["Ubicación", evento[3]],
                ["Referencia", evento[4]],
                ["Responsable", evento[1]],
                ["Fecha", convertirFecha(evento[2])]
            ];

            datosEvento.forEach(([etiqueta, valor]) => {
                const parrafo = crearElemento("p");

                const fuerte = crearElemento(
                    "strong",
                    "",
                    etiqueta + ": "
                );

                parrafo.appendChild(fuerte);
                parrafo.appendChild(
                    document.createTextNode(String(valor))
                );

                detalles.appendChild(parrafo);
            });

            articulo.appendChild(encabezadoEvento);
            articulo.appendChild(detalles);

            historialDiv.appendChild(articulo);
        }

    } catch (error) {
        console.error("Error al consultar:", error);

        resultado.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}

document.getElementById("btnConsultar")
    .addEventListener("click", consultarMedicamento);


// ==========================================
// REGISTRAR ETAPA DE TRAZABILIDAD
// ==========================================

async function registrarEtapa() {
    const mensaje = document.getElementById(
        "mensajeEtapa"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const gtin = document.getElementById(
            "gtinEtapa"
        ).value.trim();

        const serie = document.getElementById(
            "serieEtapa"
        ).value.trim();

        const etapa = Number(
            document.getElementById("etapa").value
        );

        const ubicacion = document.getElementById(
            "ubicacionEtapa"
        ).value.trim();

        const referencia = document.getElementById(
            "referenciaEtapa"
        ).value.trim();

        if (!/^\d{14}$/.test(gtin)) {
            throw new Error(
                "El GTIN debe tener exactamente 14 dígitos."
            );
        }

        if (!serie || !ubicacion || !referencia) {
            throw new Error(
                "Completa todos los campos."
            );
        }

        if (!Number.isInteger(etapa) || etapa < 0 || etapa > 4) {
            throw new Error(
                "Selecciona una etapa válida."
            );
        }

        const siguiente = await consultarSiguienteEtapa(
            gtin,
            serie
        );

        if (!siguiente) {
            throw new Error(
                "No se pudo validar el recorrido."
            );
        }

        if (siguiente.completado) {
            throw new Error(
                "El recorrido ya está completo."
            );
        }

        if (siguiente.numero !== etapa) {
            throw new Error(
                "Etapa incorrecta. La siguiente etapa es: " +
                siguiente.nombre
            );
        }

        const rolNecesarioPorEtapa = {
            0: 2,
            1: 2,
            2: 3,
            3: 3,
            4: 4
        };

        const rolUsuario = Number(
            await contrato.consultarRol(direccionUsuario)
        );

        if (rolUsuario !== rolNecesarioPorEtapa[etapa]) {
            throw new Error(
                "No tienes permisos para registrar esta etapa."
            );
        }

        mensaje.textContent =
            "Esperando confirmación en MetaMask...";

        const transaccion = await contrato.registrarEtapa(
            gtin,
            serie,
            etapa,
            ubicacion,
            referencia
        );

        mensaje.textContent =
            "Transacción enviada. Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent =
            "¡Etapa registrada correctamente en Sepolia!";

        // Actualizar el historial del medicamento registrado.
        document.getElementById("gtinConsulta").value = gtin;
        document.getElementById("serieConsulta").value = serie;

        await consultarMedicamento();

    } catch (error) {
        console.error(
            "Error al registrar etapa:",
            error
        );

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}

document.getElementById("btnRegistrarEtapa")
    .addEventListener("click", registrarEtapa);


// ==========================================
// ACTUALIZAR ETAPAS SEGÚN EL ROL
// ==========================================

function actualizarEtapasPorRol(rol) {
    const selector = document.getElementById("etapa");

    selector.replaceChildren();

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
        const opcion = crearElemento(
            "option",
            "",
            "No tienes etapas asignadas"
        );

        opcion.value = "";

        selector.appendChild(opcion);
        selector.disabled = true;

        return;
    }

    selector.disabled = false;

    etapas.forEach(etapa => {
        const opcion = crearElemento(
            "option",
            "",
            etapa.nombre
        );

        opcion.value = etapa.valor;

        selector.appendChild(opcion);
    });
}


// ==========================================
// MOSTRAR SECCIONES SEGÚN EL ROL
// ==========================================

function actualizarInterfazPorRol(rol) {
    const rolActual = Number(rol);

    const seccionAdministracion =
        document.getElementById("seccionAdministracion");

    const seccionMedicamentos =
        document.getElementById("seccionRegistroMedicamentos");

    const seccionEtapas =
        document.getElementById("seccionRegistroEtapas");

    if (seccionAdministracion) {
        seccionAdministracion.style.display =
            rolActual === 1 ? "" : "none";
    }

    if (seccionMedicamentos) {
        seccionMedicamentos.style.display =
            rolActual === 2 ? "" : "none";
    }

    if (seccionEtapas) {
        seccionEtapas.style.display =
            [2, 3, 4].includes(rolActual) ? "" : "none";
    }
}

// ==========================================
// ADMINISTRACIÓN DE PARTICIPANTES
// ==========================================

async function registrarNuevoParticipante() {
    const mensaje = document.getElementById(
        "mensajeAdministracion"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const direccion = document.getElementById(
            "direccionParticipante"
        ).value.trim();

        const rol = Number(
            document.getElementById("rolParticipante").value
        );

        if (!ethers.isAddress(direccion)) {
            throw new Error(
                "La dirección de la billetera no es válida."
            );
        }

        mensaje.textContent =
            "Enviando transacción a Sepolia...";

        const transaccion = await contrato.registrarParticipante(
            direccion,
            rol
        );

        mensaje.textContent =
            "Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent =
            "¡Participante registrado correctamente!";

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}


async function cambiarRolParticipante() {
    const mensaje = document.getElementById(
        "mensajeAdministracion"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const direccion = document.getElementById(
            "direccionParticipante"
        ).value.trim();

        const rol = Number(
            document.getElementById("rolParticipante").value
        );

        if (!ethers.isAddress(direccion)) {
            throw new Error(
                "La dirección de la billetera no es válida."
            );
        }

        mensaje.textContent =
            "Enviando cambio de rol a Sepolia...";

        const transaccion = await contrato.cambiarRol(
            direccion,
            rol
        );

        mensaje.textContent =
            "Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent =
            "¡Rol actualizado correctamente!";

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}


async function consultarRolParticipante() {
    const mensaje = document.getElementById(
        "mensajeAdministracion"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const direccion = document.getElementById(
            "direccionParticipante"
        ).value.trim();

        if (!ethers.isAddress(direccion)) {
            throw new Error(
                "La dirección de la billetera no es válida."
            );
        }

        const rol = await contrato.consultarRol(
            direccion
        );

        mensaje.textContent =
            "Rol del participante: " +
            (NOMBRES_ROLES[Number(rol)] || "Desconocido");

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}


async function desactivarParticipante() {
    const mensaje = document.getElementById(
        "mensajeAdministracion"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero debes conectar MetaMask."
            );
        }

        const direccion = document.getElementById(
            "direccionParticipante"
        ).value.trim();

        if (!ethers.isAddress(direccion)) {
            throw new Error(
                "La dirección de la billetera no es válida."
            );
        }

        mensaje.textContent =
            "Enviando solicitud a Sepolia...";

        const transaccion = await contrato.desactivarParticipante(
            direccion
        );

        mensaje.textContent =
            "Esperando confirmación...";

        await transaccion.wait();

        mensaje.textContent =
            "¡Participante desactivado correctamente!";

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}


// ==========================================
// CONSULTAR SIGUIENTE ETAPA
// ==========================================

async function consultarSiguienteEtapa(gtin, serie) {
    try {
        const eventos = await contrato.consultarHistorial(
            gtin,
            serie
        );

        const totalEtapas = eventos.length;

        if (totalEtapas >= 5) {
            return {
                completado: true,
                mensaje: "El recorrido del medicamento está completo."
            };
        }

        return {
            completado: false,
            numero: totalEtapas,
            nombre: NOMBRES_ETAPAS[totalEtapas]
        };

    } catch (error) {
        console.error(
            "Error al consultar siguiente etapa:",
            error
        );

        return null;
    }
}


async function mostrarSiguienteEtapa() {
    const mensaje = document.getElementById(
        "siguienteEtapa"
    );

    try {
        if (!contrato) {
            throw new Error(
                "Primero conecta MetaMask."
            );
        }

        const gtin = document.getElementById(
            "gtinEtapa"
        ).value.trim();

        const serie = document.getElementById(
            "serieEtapa"
        ).value.trim();

        if (!/^\d{14}$/.test(gtin) || !serie) {
            throw new Error(
                "Ingresa un GTIN válido y un número de serie."
            );
        }

        mensaje.textContent =
            "Consultando recorrido en blockchain...";

        const siguiente = await consultarSiguienteEtapa(
            gtin,
            serie
        );

        if (!siguiente) {
            throw new Error(
                "No se pudo consultar el historial."
            );
        }

        if (siguiente.completado) {
            mensaje.textContent = siguiente.mensaje;
            return;
        }

        mensaje.textContent =
            "Siguiente etapa: " + siguiente.nombre;

    } catch (error) {
        console.error(error);

        mensaje.textContent =
            "Error: " + obtenerMensajeError(error);
    }
}

document.getElementById("btnConsultarSiguiente")
    .addEventListener("click", mostrarSiguienteEtapa);


// ==========================================
// GS1 DIGITAL LINK
// ==========================================

function construirGS1DigitalLink(gtin, serie) {
    if (!/^\d{14}$/.test(gtin)) {
        throw new Error(
            "El GTIN debe tener exactamente 14 dígitos."
        );
    }

    if (!serie || !serie.trim()) {
        throw new Error(
            "El número de serie es obligatorio."
        );
    }

    const serieCodificada = encodeURIComponent(
        serie.trim()
    );

    return `https://id.gs1.org/01/${gtin}/21/${serieCodificada}`;
}


// ==========================================
// GENERAR ENLACE Y CÓDIGO QR
// ==========================================

document.getElementById("btnGenerarGS1")
    .addEventListener("click", function() {
        const gtin = document.getElementById(
            "gtinGS1"
        ).value.trim();

        const serie = document.getElementById(
            "serieGS1"
        ).value.trim();

        const resultado = document.getElementById(
            "resultadoGS1"
        );

        const contenedorQR = document.getElementById(
            "codigoQR"
        );

        try {
            const enlace = construirGS1DigitalLink(
                gtin,
                serie
            );

            resultado.replaceChildren();

            resultado.appendChild(
                crearElemento(
                    "strong",
                    "",
                    "Enlace GS1 generado:"
                )
            );

            const enlaceElemento = document.createElement("a");

            enlaceElemento.href = enlace;
            enlaceElemento.target = "_blank";
            enlaceElemento.rel = "noopener noreferrer";
            enlaceElemento.textContent = enlace;

            resultado.appendChild(
                document.createElement("br")
            );

            resultado.appendChild(enlaceElemento);

            contenedorQR.replaceChildren();

            if (typeof QRCode === "undefined") {
                throw new Error(
                    "No se pudo cargar la biblioteca QR."
                );
            }

            new QRCode(contenedorQR, {
                text: enlace,
                width: 200,
                height: 200,
                correctLevel: QRCode.CorrectLevel.H
            });

        } catch (error) {
            resultado.textContent = error.message;
            contenedorQR.replaceChildren();
        }
    });


// ==========================================
// LECTOR DE CÓDIGOS QR
// ==========================================

async function detenerEscaneoQR() {
    if (!lectorQR) {
        return;
    }

    try {
        await lectorQR.stop();
        lectorQR.clear();
    } catch (error) {
        console.warn(
            "No fue necesario detener el lector:",
            error
        );
    }

    lectorQR = null;
}


async function iniciarEscaneoQR() {
    const resultado = document.getElementById(
        "resultadoEscaneo"
    );

    try {
        if (typeof Html5Qrcode === "undefined") {
            throw new Error(
                "No se pudo cargar la biblioteca de lectura QR."
            );
        }

        if (lectorQR) {
            await detenerEscaneoQR();
        }

        lectorQR = new Html5Qrcode("lectorQR");

        resultado.textContent =
            "Iniciando cámara...";

        await lectorQR.start(
            { facingMode: "environment" },

            {
                fps: 10,
                qrbox: {
                    width: 220,
                    height: 220
                }
            },

            async function(textoQR) {
                try {
                    const url = new URL(textoQR);

                    if (url.hostname !== "id.gs1.org") {
                        throw new Error(
                            "El QR no contiene un enlace GS1 válido."
                        );
                    }

                    const coincidencia = url.pathname.match(
                        /^\/01\/(\d{14})\/21\/([^/]+)\/?$/
                    );

                    if (!coincidencia) {
                        throw new Error(
                            "El enlace GS1 no tiene el formato esperado."
                        );
                    }

                    const gtin = coincidencia[1];

                    const serie = decodeURIComponent(
                        coincidencia[2]
                    );

                    document.getElementById(
                        "gtinConsulta"
                    ).value = gtin;

                    document.getElementById(
                        "serieConsulta"
                    ).value = serie;

                    document.getElementById(
                        "gtinGS1"
                    ).value = gtin;

                    document.getElementById(
                        "serieGS1"
                    ).value = serie;

                    resultado.textContent =
                        "QR leído correctamente. Consultando medicamento...";

                    await detenerEscaneoQR();

                    await consultarMedicamento();

                    resultado.textContent =
                        "Lectura QR finalizada. Revisa la consulta del medicamento.";

                } catch (error) {
                    resultado.textContent =
                        error.message;
                }
            }
        );

        resultado.textContent =
            "Cámara activa. Enfoca el código QR.";

    } catch (error) {
        console.error(
            "Error al iniciar lector QR:",
            error
        );

        resultado.textContent =
            "No se pudo iniciar la cámara. Revisa los permisos del navegador.";
    }
}

document.getElementById("btnIniciarEscaneo")
    .addEventListener("click", iniciarEscaneoQR);


// ==========================================
// BOTONES DE ADMINISTRACIÓN
// ==========================================

document.getElementById("btnRegistrarParticipante")
    .addEventListener("click", registrarNuevoParticipante);

document.getElementById("btnCambiarRol")
    .addEventListener("click", cambiarRolParticipante);

document.getElementById("btnDesactivarParticipante")
    .addEventListener("click", desactivarParticipante);

document.getElementById("btnConsultarRol")
    .addEventListener("click", consultarRolParticipante);


// ==========================================
// NAVEGACIÓN VISUAL
// ==========================================

document.querySelectorAll(".nav-link").forEach(enlace => {
    enlace.addEventListener("click", function() {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");
    });
});


// ==========================================
// INICIO
// ==========================================

actualizarDashboardDesconexion();
limpiarDashboardMedicamento();
actualizarEtapasPorRol(0);
actualizarInterfazPorRol(0);

console.log("MedicTrace V3 iniciado correctamente.");

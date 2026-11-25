
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RegistroMedicamentosV2 {

    // 1. Roles de los participantes del sistema
    enum Rol {
        Ninguno,
        Administrador,
        Laboratorio,
        Distribuidor,
        Farmacia,
        Regulador
    }

    // 2. Etapas del recorrido del medicamento
    enum Etapa {
        Fabricacion,
        DespachoDistribuidor,
        RecepcionDistribuidor,
        DespachoFarmacia,
        RecepcionFarmacia
    }

    // 3. Informacion principal del medicamento
    struct Medicamento {
        string gtin;
        string numeroLote;
        string numeroSerie;
        uint256 fechaVencimiento;
        bool registrado;
    }

    // 4. Informacion de cada movimiento del medicamento
    struct EventoTrazabilidad {
        Etapa etapa;
        address responsable;
        uint256 fecha;
        string ubicacion;
        string referencia;
    }

    // 5. Administrador principal
    address public administrador;

    // 6. Rol asignado a cada participante
    mapping(address => Rol) public roles;

    // 7. Registro de medicamentos
    mapping(bytes32 => Medicamento) private medicamentos;

    // 8. Historial de movimientos de cada medicamento
    mapping(bytes32 => EventoTrazabilidad[]) private historial;

    // 9. Eventos para registrar cambios importantes
    event ParticipanteRegistrado(
        address participante,
        Rol rol
    );

    event MedicamentoRegistrado(
        string gtin,
        string numeroLote,
        string numeroSerie
    );

    event EtapaRegistrada(
        string gtin,
        string numeroSerie,
        Etapa etapa,
        address responsable
    );

    // 10. Constructor: asigna el administrador inicial
    constructor() {
        administrador = msg.sender;
        roles[msg.sender] = Rol.Administrador;
    }

    // 11. Permiso exclusivo para el administrador
    modifier soloAdministrador() {
        require(
            msg.sender == administrador,
            "Solo el administrador puede realizar esta accion"
        );
        _;
    }

    // 12. Permiso para los laboratorios
    modifier soloLaboratorio() {
        require(
            roles[msg.sender] == Rol.Laboratorio,
            "Solo un laboratorio autorizado"
        );
        _;
    }

function registrarParticipante(
    address participante,
    Rol rol
) external soloAdministrador {

    require(
        participante != address(0),
        "Direccion invalida"
    );

    require(
        rol != Rol.Ninguno &&
        rol != Rol.Administrador,
        "Rol no permitido"
    );

    roles[participante] = rol;

    emit ParticipanteRegistrado(participante, rol);
}

function cambiarRol(
    address participante,
    Rol nuevoRol
) external soloAdministrador {

    require(
        participante != address(0),
        "Direccion invalida"
    );

    require(
        nuevoRol != Rol.Ninguno &&
        nuevoRol != Rol.Administrador,
        "Rol no permitido"
    );

    require(
        roles[participante] != Rol.Ninguno,
        "Participante no registrado"
    );

    roles[participante] = nuevoRol;

    emit ParticipanteRegistrado(participante, nuevoRol);
}

function desactivarParticipante(
    address participante
) external soloAdministrador {

    require(
        participante != address(0),
        "Direccion invalida"
    );

    require(
        roles[participante] != Rol.Ninguno,
        "Participante no registrado"
    );

    roles[participante] = Rol.Ninguno;

    emit ParticipanteRegistrado(
        participante,
        Rol.Ninguno
    );
}


function consultarRol(
    address participante
) external view returns (Rol) {

    return roles[participante];
}


function registrarMedicamento(
    string memory gtin,
    string memory numeroLote,
    string memory numeroSerie,
    uint256 fechaVencimiento
) external soloLaboratorio {

    
require(
    bytes(gtin).length == 14,
    "GTIN debe tener 14 digitos"
);

for (uint256 i = 0; i < bytes(gtin).length; i++) {
    require(
        bytes(gtin)[i] >= 0x30 &&
        bytes(gtin)[i] <= 0x39,
        "GTIN solo admite numeros"
    );
}

    require(bytes(numeroLote).length > 0, "Lote obligatorio");
    require(bytes(numeroSerie).length > 0, "Serie obligatoria");

    require(
        fechaVencimiento > block.timestamp,
        "Fecha de vencimiento invalida"
    );

    bytes32 identificador = keccak256(
        abi.encodePacked(gtin, numeroSerie)
    );

    require(
        !medicamentos[identificador].registrado,
        "Medicamento ya registrado"
    );

    medicamentos[identificador] = Medicamento({
        gtin: gtin,
        numeroLote: numeroLote,
        numeroSerie: numeroSerie,
        fechaVencimiento: fechaVencimiento,
        registrado: true
    });

    emit MedicamentoRegistrado(
        gtin,
        numeroLote,
        numeroSerie
    );
}



function registrarEtapa(
    string memory gtin,
    string memory numeroSerie,
    Etapa etapa,
    string memory ubicacion,
    string memory referencia
) external {

    bytes32 identificador = keccak256(
        abi.encodePacked(gtin, numeroSerie)
    );

    require(
        medicamentos[identificador].registrado,
        "Medicamento no encontrado"
    );

    require(
        bytes(ubicacion).length > 0,
        "Ubicacion obligatoria"
    );

    require(
        bytes(referencia).length > 0,
        "Referencia obligatoria"
    );

    uint256 etapaActual = uint256(etapa);

    require(
        etapaActual == historial[identificador].length,
        "Etapa fuera de orden"
    );

    Rol rolActual = roles[msg.sender];

    if (etapa == Etapa.Fabricacion ||
        etapa == Etapa.DespachoDistribuidor) {
        require(
            rolActual == Rol.Laboratorio,
            "Solo laboratorio"
        );
    } else if (
        etapa == Etapa.RecepcionDistribuidor ||
        etapa == Etapa.DespachoFarmacia
    ) {
        require(
            rolActual == Rol.Distribuidor,
            "Solo distribuidor"
        );
    } else if (etapa == Etapa.RecepcionFarmacia) {
        require(
            rolActual == Rol.Farmacia,
            "Solo farmacia"
        );
    } else {
        revert("Etapa invalida");
    }

    historial[identificador].push(
        EventoTrazabilidad({
            etapa: etapa,
            responsable: msg.sender,
            fecha: block.timestamp,
            ubicacion: ubicacion,
            referencia: referencia
        })
    );


    emit EtapaRegistrada(
        gtin,
        numeroSerie,
        etapa,
        msg.sender
    );
}


function consultarHistorial(
    string memory gtin,
    string memory numeroSerie
)
    external
    view
    returns (EventoTrazabilidad[] memory)
{
    bytes32 identificador = keccak256(
        abi.encodePacked(gtin, numeroSerie)
    );

    require(
        medicamentos[identificador].registrado,
        "Medicamento no encontrado"
    );

    return historial[identificador];
}

function consultarMedicamento(
    string memory gtin,
    string memory numeroSerie
)
    external
    view
    returns (
        string memory,
        string memory,
        string memory,
        uint256,
        bool
    )
{
    bytes32 identificador = keccak256(
        abi.encodePacked(gtin, numeroSerie)
    );

    Medicamento memory medicamento = medicamentos[identificador];

    require(
        medicamento.registrado,
        "Medicamento no encontrado"
    );

    return (
        medicamento.gtin,
        medicamento.numeroLote,
        medicamento.numeroSerie,
        medicamento.fechaVencimiento,
        medicamento.registrado
    );
}

}

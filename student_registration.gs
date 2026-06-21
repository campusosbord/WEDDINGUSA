/** =========================================================================
 * CONFIGURACIÓN DE PIXELES (Separados por Empresa)
 * ========================================================================== */

// 1. Datos para la LLC (USA / LATAM - Ticket Alto)
const LLC_PIXEL_ID = "1523091419179735";
const LLC_ACCESS_TOKEN = "EAAUc93joBTABRVEk02lCea1lOF7os8cePZB18Wb7fvTAYuf3Wr1wodmp6h6j8udN5DDO6s3dU6Y455qQSEAwy2AWDRuZAcoNc1Gq0tIzowZAZCyqjitEq4MhhK9QCt6SrdBHWNi6auP6KfyliMIcknxfnczWZCVCVP1lb4zHN5N0QKs80ScpqNzFnXFh6GgZDZD";

// 2. Datos para VENEZUELA (Ticket Bajo)
const VZLA_PIXEL_ID = "4325234107759872";
const VZLA_ACCESS_TOKEN = "EAAUc93joBTABQww3quuBuGEu2agEeyrt0hFkLDJFW7Og49bVJE8bJFMB1iZADdZAdrfDZBpinS7vXCtXjTl5HEytOZCsIk5avOn5Bw9hev6VUqBRLZCMRjoe9JqZAG19gfIRUVz0TZB0ZANZAwgND1FfVWY7kSEIGpQTBiag0aPAsB3Hwt6HPuSznBMATTzDwJgZDZD";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Wz-CqEcyzFKh0sb0OEnZRLoNUdhUQRqPwqIUPfLH_BM/edit"; 

/** =========================================================================
 * EL ENRUTADOR (Define hojas y píxeles)
 * ========================================================================== */
const RUTAS = {
  "enfermeria": { 
    hoja: "datausaenfermeria",
    prepararFila: (data, fecha) => [data.nombre || "", data.telefono || "", data.email || "", fecha],
    enviarMeta: true,
    pixel: LLC_PIXEL_ID,
    token: LLC_ACCESS_TOKEN,
    metaNombre: "Auxiliar de Enfermeria Clinica",
    metaCategoria: "Formacion Superior",
    valorDefecto: 1250.00
  },
  "datosweb": { 
    hoja: "datosweb",
    prepararFila: (data, fecha) => [data.nombre || "", data.telefono || "", data.email || "", fecha, data.plan || "", data.metodo || ""],
    enviarMeta: true,
    pixel: VZLA_PIXEL_ID,
    token: VZLA_ACCESS_TOKEN,
    metaNombre: "Master Wedding Planner VZLA",
    metaCategoria: "Formacion",
    valorDefecto: 120.00,
    metaEvento: "Purchase"
  },
  "interiorismo": { 
    hoja: "datosweb Interiorismo",
    prepararFila: (data, fecha) => [data.nombre || "", data.telefono || "", data.email || "", fecha, data.plan || "", data.metodo || ""],
    enviarMeta: true,
    pixel: VZLA_PIXEL_ID,
    token: VZLA_ACCESS_TOKEN,
    metaNombre: "Master Interiorismo 3D VZLA",
    metaCategoria: "Formacion Ejecutiva",
    valorDefecto: 120.00,
    metaEvento: "Purchase"
  },
  "datosweb2": { 
    hoja: "datosweb2",
    prepararFila: (data, fecha) => [data.nombre || "", data.telefono || "", data.email || "", fecha, data.plan || "", data.metodo || ""],
    enviarMeta: true,
    pixel: VZLA_PIXEL_ID,
    token: VZLA_ACCESS_TOKEN,
    metaNombre: "Master Interiorismo 3D VZLA",
    metaCategoria: "Formacion Ejecutiva",
    valorDefecto: 120.00,
    metaEvento: "Purchase"
  },
  "datavzlaenfermeria": {
    hoja: "datavzlaenfermeria",
    prepararFila: (data, fecha) => [data.nombre || "", data.telefono || "", data.email || "", fecha],
    enviarMeta: true,
    pixel: VZLA_PIXEL_ID,
    token: VZLA_ACCESS_TOKEN,
    metaNombre: "Auxiliar de Enfermería Venezuela",
    metaCategoria: "Formacion Ejecutiva",
    valorDefecto: 120.00,
    metaEvento: "Purchase"
  }
};

/** =========================================================================
 * FUNCIÓN PRINCIPAL (doPost)
 * ========================================================================== */
function doPost(e) {
  try {
    // Captura de datos robusta (Híbrida)
    var data = (e && e.parameter) ? e.parameter : {}; 
    if (e && e.postData && e.postData.contents) {
      try {
        var json = JSON.parse(e.postData.contents);
        data = json; // Si es JSON, lo usamos
      } catch (i) {}
    }

    // Registro en la consola de Google para auditoría
    console.log("Datos brutos recibidos: " + JSON.stringify(data));

    // NORMALIZACIÓN DE DATOS (Mapeo inteligente y recursivo de sinónimos)
    var datosNormalizados = Object.assign({}, data, {
      nombre: obtenerCampo(data, ["nombre", "name", "first_name", "buyer_name", "customer_name", "billing_first_name", "full_name"]),
      telefono: obtenerCampo(data, ["telefono", "phone", "tel", "checkout_phone", "billing_phone", "phone_number", "celular", "mobile"]),
      email: obtenerCampo(data, ["email", "mail", "buyer_email", "customer_email", "billing_email"]),
      plan: obtenerCampo(data, ["plan", "product", "producto", "item", "plan_name", "product_name", "offer"]),
      metodo: obtenerCampo(data, ["metodo", "metodo_pago", "payment_method", "payment", "gateway", "pay_mode"])
    });

    console.log("Datos normalizados para procesar: " + JSON.stringify(datosNormalizados));

    // Mantener "datosweb2" como fallback por seguridad para evitar conversiones falsas de compra
    var origen = datosNormalizados.origen || "datosweb2";
    var configRuta = RUTAS[origen];

    if (!configRuta) {
      console.error("Origen no encontrado: " + origen);
      return responderError("Origen no configurado.");
    }

    // 1. Guardar en Google Sheets
    var ss = SpreadsheetApp.openByUrl(SHEET_URL);
    var sheet = ss.getSheetByName(configRuta.hoja);
    
    if (!sheet) {
      console.error("No se encontró la hoja: " + configRuta.hoja);
      return responderError("Hoja de Excel no encontrada.");
    }

    // Usar el array de datos normalizados
    var nuevaFila = configRuta.prepararFila(datosNormalizados, new Date());
    sheet.appendRow(nuevaFila);

    // 2. Enviar a Meta CAPI
    if (configRuta.enviarMeta) {
      enviarAPI_Meta(datosNormalizados, configRuta);
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error crítico: " + error.toString());
    return responderError(error.toString());
  }
}

/** =========================================================================
 * LÓGICA DE META (CAPI)
 * ========================================================================== */
function enviarAPI_Meta(data, config) {
  const url = "https://graph.facebook.com/v19.0/" + config.pixel + "/events?access_token=" + config.token;
  
  let valorEvento = config.valorDefecto;
  if (config.pixel === VZLA_PIXEL_ID) {
    valorEvento = 120.00; // En todo caso siempre mande 120$ para Venezuela
  }

  const hashedEmail = hashData((data.email || "").trim().toLowerCase());
  
  // Normalizar y agregar código de país (58) a números venezolanos de 11 dígitos que empiecen con "04..."
  let rawPhone = (data.telefono || "").toString().replace(/\D/g, '');
  if (rawPhone.length === 11 && rawPhone.startsWith("04")) {
    rawPhone = "58" + rawPhone.slice(1);
  } else if (rawPhone.length === 10 && rawPhone.startsWith("4")) {
    rawPhone = "58" + rawPhone;
  }
  const hashedPhone = hashData(rawPhone);
  
  const nombreEvento = config.metaEvento || "Lead";
  
  // Generación segura de ID de respaldo con sufijo aleatorio para evitar colisiones
  const eventId = data.event_id || (nombreEvento.toLowerCase() + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));

  const payload = {
    "data": [{
      "event_name": nombreEvento,
      "event_time": Math.floor(Date.now() / 1000),
      "event_id": eventId,
      "action_source": "website",
      "event_source_url": data.page_url || "",
      "user_data": {
        "em": [hashedEmail],
        "ph": [hashedPhone],
        "client_user_agent": data.user_agent || ""
      },
      "custom_data": {
        "currency": "USD",
        "value": valorEvento,
        "content_name": config.metaNombre,
        "content_category": config.metaCategoria
      }
    }],
  };

  const response = UrlFetchApp.fetch(url, {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  });
  
  console.log("Respuesta de Meta (" + config.pixel + "): " + response.getContentText());
}

/** =========================================================================
 * UTILIDADES DE BÚSQUEDA Y NORMALIZACIÓN
 * ========================================================================== */

function obtenerCampo(obj, posiblesClaves) {
  if (!obj) return "";
  
  for (let i = 0; i < posiblesClaves.length; i++) {
    let claveBuscar = posiblesClaves[i].toLowerCase();
    for (let k in obj) {
      if (k.toLowerCase() === claveBuscar && obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== 'object') {
        return obj[k];
      }
    }
  }
  
  for (let i = 0; i < posiblesClaves.length; i++) {
    let valor = buscarEnObjetoProfundo(obj, posiblesClaves[i]);
    if (valor !== null && valor !== undefined && valor !== "") {
      return valor;
    }
  }
  
  return "";
}

function buscarEnObjetoProfundo(obj, claveBuscar) {
  if (typeof obj !== 'object' || obj === null) return null;
  let claveBuscarLower = claveBuscar.toLowerCase();
  
  for (let k in obj) {
    if (k.toLowerCase() === claveBuscarLower && typeof obj[k] !== 'object' && obj[k] !== null) {
      return obj[k];
    }
  }
  
  for (let k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      let resultado = buscarEnObjetoProfundo(obj[k], claveBuscar);
      if (resultado !== null && resultado !== undefined) {
        return resultado;
      }
    }
  }
  return null;
}

function hashData(text) {
  if (!text) return "";
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function responderError(mensaje) {
  return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": mensaje}))
    .setMimeType(ContentService.MimeType.JSON);
}

function PROBAR_ENVIO_MANUAL() {
  const datosPrueba = {
    nombre: "Prueba Manual Compra",
    email: "test_compra@gmail.com",
    telefono: "1234567890",
    origen: "datavzlaenfermeria",
    page_url: "https://enfermeria.osbord.com/venezuela"
  };
  enviarAPI_Meta(datosPrueba, RUTAS["datavzlaenfermeria"]);
}

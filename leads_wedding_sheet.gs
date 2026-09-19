/** =========================================================================
 * REGISTRO DE LEADS - LEAD_USA_WEDDING + SENDER.NET
 * Hoja: wedding
 * Columnas: NOMBRE Y APELLIDOS | CORREO ELECTRÓNICO
 * Grupo Sender.net: DIPLOMADO WEDDING USA (ID: bYBrJ9)
 * Instituto Osbord
 * ========================================================================== */

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KVgZusucf4VgGq-ezVHwn_2Moa2ZO_Htkjy45QmXH2E/edit";

// Configuración Sender.net
const SENDER_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOTVlYTNjY2UxMjIxNWFjNzIwOTUyNWYyOWQ2MWU3MmYzZWNkY2NmYzRkNWEyZDI0YWZlM2Q3ODJkMDdkYmJkNTU5YjYyOWM1NmU4MzAwNDQiLCJpYXQiOjE3ODA3Njc0NjYuMjE2NTAyLCJuYmYiOjE3ODA3Njc0NjYuMjE2NTA0LCJleHAiOjQ5MzQzNjc0NjYuMjE0MzA5LCJzdWIiOiIxMDczNTk4Iiwic2NvcGVzIjpbXX0.ALc_TT95U9JXD8xbeJG7HRDcGgGhV7mJw8TNiZ-PiT0LB6HHuQk4mTt_mhBu64Y8bEm60Cni9mdv6I71drRe0-PqtjAdfVllzRaHXqHWa81xxb9_jx9uZ0w169NPFgMtRqjkc5brPkc74AAGV42l7mvw-cK8rkfe1YoW9rZ0UuCQyBfQ195armt1bcM07lay7wkS--Dqu9eaNjL94BKWhWyDfwSJKYQbFRp5xGjSilxk_5ikKmhNV5efEhMTH1xcs6J6fUzFJUuXXLFdx1Vr9-qgaPTo87k0fD3Dcf1K6721q9yRFtBKLuALB1XDbVIBAJHGQOPwhxhmfmekXmxWWD_DBxCGy_4diljgnY8Tagh_WjElnUxKSb_Og9sjdg5ljUomd_dnYEnNQIA2GmZz4IC5MmkZH8G2hhGLPaPxHUg5VPU4j7ZJlZP7hBM8_AtJhZFp7TnFnZbtb5NDv7-dhPPe34fXxEeO5DaOZGoSwyJfbna3SMhzIwDXcPxAIMrpqh5_5w2zEAIoqi7AJOT33OanPqQfBbUYWo2SMWuaLmQUcQDw3d_UHWjZcERX9raFbMwZYyajczcI1sBqvJB211nYL-gqqDFA7nIJ6m9Svn7ZXI8KiH6acZnhvUAU7e3k6O9FXymFEVLZP510tc491T-PGRDeAbjhN-_g7AJPfSo";
const SENDER_GROUP_ID = "bYBrJ9"; // DIPLOMADO WEDDING USA

function doPost(e) {
  try {
    var data = (e && e.parameter) ? e.parameter : {}; 
    if (e && e.postData && e.postData.contents) {
      try {
        var json = JSON.parse(e.postData.contents);
        data = json;
      } catch (i) {}
    }

    var nombre = data["NOMBRE Y APELLIDOS"] || data.nombre || data.name || "";
    var email = data["CORREO ELECTRÓNICO"] || data.email || data.correo || "";

    // 1. Abre el documento LEAD_USA_WEDDING directamente por su URL
    var ss = SpreadsheetApp.openByUrl(SHEET_URL);
    var sheet = ss.getSheetByName("wedding");

    if (!sheet) {
      sheet = ss.getActiveSheet();
    }

    // 2. Registrar en las 2 columnas exactas: [NOMBRE Y APELLIDOS, CORREO ELECTRÓNICO]
    sheet.appendRow([nombre.toString().trim(), email.toString().trim()]);

    // 3. Registrar suscriptor en Sender.net en el grupo DIPLOMADO WEDDING USA
    try {
      enviarASender(email.toString().trim(), nombre.toString().trim());
    } catch (errSender) {
      Logger.log("Error al sincronizar con Sender.net: " + errSender.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Lead registrado en Google Sheets y Sender.net"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función auxiliar para registrar suscriptor en la API de Sender.net
 */
function enviarASender(email, nombre) {
  if (!email) {
    Logger.log("enviarASender: email vacío, saliendo.");
    return;
  }

  Logger.log("enviarASender: Iniciando para email=" + email + ", nombre=" + nombre);

  var partes = (nombre || "").trim().split(" ");
  var firstname = partes[0] || "";
  var lastname = partes.slice(1).join(" ") || "";

  var payload = {
    email: email,
    firstname: firstname,
    lastname: lastname,
    groups: [SENDER_GROUP_ID],
    trigger_automation: true
  };

  Logger.log("enviarASender: Payload = " + JSON.stringify(payload));

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + SENDER_TOKEN,
      "Accept": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch("https://api.sender.net/v2/subscribers", options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();

  Logger.log("enviarASender: Código HTTP = " + responseCode);
  Logger.log("enviarASender: Respuesta = " + responseBody);

  if (responseCode >= 200 && responseCode < 300) {
    Logger.log("enviarASender: ✅ Suscriptor registrado exitosamente en Sender.net");
  } else {
    Logger.log("enviarASender: ❌ Error al registrar. Código: " + responseCode);
  }

  return { code: responseCode, body: responseBody };
}

/**
 * Función de prueba: Ejecutar directamente desde el editor de Apps Script
 * para verificar que la conexión con Sender.net funciona.
 * Menú: Ejecutar → testSenderNet
 */
function testSenderNet() {
  var resultado = enviarASender("test_appscript_osbord@test.com", "Prueba AppScript");
  Logger.log("=== RESULTADO DEL TEST ===");
  Logger.log("Código: " + resultado.code);
  Logger.log("Respuesta: " + resultado.body);
  
  if (resultado.code >= 200 && resultado.code < 300) {
    Logger.log("✅ ¡CONEXIÓN EXITOSA! La API de Sender.net funciona correctamente.");
  } else {
    Logger.log("❌ ERROR: La API devolvió código " + resultado.code);
  }
}

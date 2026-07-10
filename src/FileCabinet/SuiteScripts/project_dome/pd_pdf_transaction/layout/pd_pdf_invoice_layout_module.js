/**
 * @NApiVersion 2.1
 */
define([
        "N/runtime"
    ],

    (runtime) => {

        const handler = {}

        handler.getXml = (parameters) => {

            let html = "";

            const arrayLength = parameters.invoiceItems.length;

            parameters.invoiceItems.forEach((result, index) => {
                html += getPDFBody(parameters, index, arrayLength);
            });

            return (`<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
            <pdf>
            
                <head>
                    <style>
       
                        body {
                            font-family: Helvetica, sans-serif;
                            font-size: 7.5pt;
                            padding: 10pt;
                        }
            
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }
            
                        td {
                            padding: 4pt;
                            vertical-align: middle;
                        }
                        
                        .center {
                            text-align: center;
                        }
            
                        .right {
                            text-align: right;
                        }
            
                        .bold {
                            font-weight: bold;
                        }
            
                        .title {
                            font-size: 16pt;
                            font-weight: bold;
                        }
            
                        .label {
                            font-weight: bold;
                        }
                        
                        .address {
    text-transform: uppercase;   /* ← adicionar esta linha */
    word-break: break-all;                         
    overflow-wrap: break-word;
}
                        
                        .page-border {
                            border: 1pt solid black;
                            padding: 4pt; 
                        }
                        
                        /* ===== INVOICE LAYOUT ===== */
                        
                        .invoice-side {
                            border-left: 1pt solid black;
                            padding-left: 10pt;
                        }
                        
                        /* ===== ENDEREÇOS LAYOUT ===== */
                        
                        .address-title {
                            font-size: 9pt;
                            font-weight: bold;
                        }
                        
                        .address-wrapper {
                            width: 100%;
                            border: 1pt solid black;
                            border-collapse: collapse;
                            margin-top: 15pt;
                            table-layout: fixed;
                        }
                        
                        .address-cell {
                            padding: 10pt;
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow-wrap: break-word;                   
                            min-height: 60pt;   
                            height: 60pt; 
                        }
                        
                        .address-divider {
                            border-left: 1pt solid black;
                        }
                        
                        /* ===== CAMPOS DE CORPO LAYOUT ===== */
                        
                        .info-wrapper {
                            width: 100%;
                            border-left: 1pt solid black;
                            border-right: 1pt solid black;
                            border-bottom: 1pt solid black;
                            border-collapse: collapse;
                            margin-top: 0pt;
                            table-layout: fixed;
                        }
                        
                        .info-cell {
                            padding: 2pt;
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                        }
                        
                        .info-divider {
                            border-left: 1pt solid black;
                        }
                        
                        .field {
                            margin-left: 1pt;
                            line-height: 0.95;
                        }
                        
                        .field-label {
                            font-weight: bold;
                        }
                        
                        .field-value {
                            white-space: normal;
                            word-wrap: break-word;
                        }
                        
                        /* ===== ITENS LAYOUT ===== */
                                            
                        .dimensions-wrapper {
                            width: 100%;
                            border-left: 1pt solid black;
                            border-right: 1pt solid black;
                            border-bottom: 1pt solid black;
                            border-collapse: collapse;
                        }
                        
                        .dimensions-cell {
                            padding: 1pt; 
                            vertical-align: top;
                        }
                        
                        .dimensions-label {
                            font-weight: bold;
                        }
                        
                        .dimensions-value {
                            white-space: normal;
                            line-height: 1;
                        }
                        
                        .item-table {
                            width: 100%;
                            border: 0.7pt solid black;
                            border-collapse: collapse;
                            margin-top: 4pt;
                            font-size: 8pt;
                            table-layout: fixed;
                        }
                        
                        .item-table th {
                            border-bottom: 0.7pt solid black;
                            font-weight: bold;
                            text-align: left;
                            padding: 2pt;
                        }
                        
                        .item-table td {
                            padding: 2pt;
                            vertical-align: top;
                            word-break: break-word;   
                            overflow-wrap: break-word;
                        }
                        
                        .item-col-center {
                            text-align: center;
                        }
                        
                        .item-col-right {
                            text-align: right;
                        }
                        
                        .item-table > tbody > tr > th,
                        .item-table > tbody > tr > td {
                            border-right: 0.5pt solid black;
                        }
                        
                        .item-table > tbody > tr > th:last-child,
                        .item-table > tbody > tr > td:last-child {
                            border-right: none;
                        }
                        
                        /* ===== DESCRIPTION BLOCK ===== */
                        
                        .desc-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        
                        .desc-table td {
                            padding: 0pt;
                            vertical-align: top;
                            padding-bottom: 0pt;
                        }
                        
                        .desc-label {
                            white-space: normal;
                            word-wrap: break-word;    
                            overflow-wrap: break-word;
                            width: 45%;  
                        }
                        
                        .desc-value {
                            white-space: normal;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                        }
                        
                        /* ===== TOTALS LAYOUT ===== */

                        .totals-wrap { 
                            width: 100%; border-collapse: collapse; margin-top: 6pt; 
                        }
                        
                        .totals-spacer { 
                            width: 60%; 
                        }
                        
                        .totals-box { 
                            width: 40%; 
                        }
                        
                        .totals { 
                            width: 100%; 
                            border-collapse: collapse;
                            border-top: 1pt solid #000;
                            border-right: 1pt solid #000;
                            border-bottom: 1pt solid #000;
                            border-left: 1pt solid #000;
                        }
                        
                        .totals-row td { 
                            border-bottom: 0.5pt solid #000;
                        }
                        
                        .totals-last td {
                            border-bottom: 0;
                        }
                        
                        .totals-key {
                            width: 60%;
                            text-align: right;
                            padding: 2pt 3pt;
                            font-size: 8pt;
                            white-space: nowrap;
                        }

                        .totals-val {
                            width: 40%;
                            text-align: right;
                            padding: 2pt 3pt;
                            font-size: 8pt;
                            white-space: nowrap;
                        }
                        
                        .bottom-wrap { width: 100%; border-collapse: collapse; margin-top: 8pt; }

                        .col-left  { width: 60%; vertical-align: top; padding-right: 6pt; }
                        .col-right { width: 40%; vertical-align: top; }
                        
                        .box {
                            width: 100%;
                            border-collapse: collapse;
                            border-top: 1pt solid #000;
                            border-right: 1pt solid #000;
                            border-bottom: 1pt solid #000;
                            border-left: 1pt solid #000;
                        }
                        
                        .box-title {
                            font-size: 8pt;
                            font-weight: bold;
                            padding: 3pt 4pt;
                            border-bottom: 0.5pt solid #000;
                        }
                        
                        .box-body {
                            padding: 4pt 4pt;
                            font-size: 8pt;
                            line-height: 10pt;
                            white-space: normal;
                        }
                        
                        .terms-body {
    font-size: 6.5pt;
    line-height: 9pt;
}
                        
                        .box-spacer { height: 6pt; font-size: 1pt; line-height: 1pt; }
                        
                        /* ===== ASSINATURA ===== */
                        .sign-area { 
                            width: 100%; 
                            border-collapse: collapse; 
                            table-layout: fixed; 
                        }

                        .sign-line {
                            height: 24pt;
                            border-bottom: 1pt solid #000;
                            text-align: center;
                            vertical-align: bottom;
                            padding-bottom: 2pt;
                        }

                        .sign-img {
                            width: 110pt;  
                            height: 18pt;
                        }
                        
                        .sign-label {
                            padding-top: 4pt;
                            font-size: 5pt;
                            text-align: center;
                            white-space: nowrap;
                        }
                                                                                       
                    </style>
                </head>
            
                <body size="A4"
                      margin-top="25pt"
                      margin-left="25pt"
                      margin-right="25pt"
                      margin-bottom="25pt"
                      border="1pt solid black">
                      ${html}                                                                  
                </body>
            </pdf>`);

        }

        function getPDFBody(parameters, index, arrayLength) {

            const termsCondition = runtime.getCurrentScript().getParameter({name: "custscript_pd_invoice_terms_condition_ds"});

            const itemArrayObject = parameters.invoiceItems[index];

            let html = (`<div style="page-break-after: always;">
                    
                        <!-- HEADER -->
                        <table>
                            <tr>
           
                                <td width="35%" class="center">
                                    <img src="https://11559462.app.netsuite.com/core/media/media.nl?id=84206&amp;c=11559462&amp;h=hwErRXmvZYBZ1W1tgUyVBvDbtGD2i_LtArnC4I6R-Wk1SfH2" width="180" />
                                </td>
            
                                <td width="35%" class="center">
                                    <span style="font-size:14pt;" class="bold">Aloia Aerospace Inc.</span><br />
                                    35 SW 12TH AVE UNIT 101<br />
                                    DANIA, FL 33004-3530<br />
                                    UNITED STATES OF AMERICA<br />
                                    Ph: 786-213-5814<br />
                                    sales@aloiaaerospace.com
                                </td>
            
                                <td width="30%" class="right invoice-side">   
                                    <span class="title">Invoice</span><br/>
                                    <span class="label">Invoice #:</span> ${escapeXml(parameters.invoiceNumber)}<br/>
                                    <span class="label">Invoice Date:</span>${escapeXml(formatDateUS(parameters.invoiceDate))}<br/>
                                    <span class="label">Invoice Time:</span>${escapeXml(formatTimeAMPM(parameters.createddate))}<br/>
                                    <span class="label">Page:</span> <pagenumber/> / <totalpages/>
                                </td>
            
                            </tr>
                        </table>
                        
                        <!-- ENDEREÇOS -->
                        <table class="address-wrapper">
                            <tr>
                            
                                <td width="35%" class="address-cell">
                                    <span class="address-title">Bill To:</span><br/>
                                    <span class="address">
                                        ${formatAddress(parameters.billTo)}
                                    </span>
                                </td>
                            
                                <td width="35%" class="address-cell address-divider">
                                    <span class="address-title">Ship To:</span><br/>
                                    <span class="address">
                                        ${formatAddress(parameters.shipTo)}
                                    </span>
                                </td>
                            
                                <td width="30%" class="address-cell address-divider">
                                    <span class="address-title">Final Destination:</span><br/>
                                    <span class="address">
                                        ${formatAddress(parameters.finalDestination)}
                                    </span>
                                </td>
                            
                            </tr>
                        </table>
                        
                        <!-- CAMPOS DE CORPO -->
                        <table class="info-wrapper">
                            <tr>                         
                                <!-- COLUNA 1 -->
                                <td width="35%" class="info-cell">
                                
                                    <div class="field">
                                        <span class="field-label">Cust PO:</span>
                                        <span class="field-value">${escapeXml(parameters.custPo)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Sales Order:</span>
                                        <span class="field-value">${escapeXml(parameters.salesOrder)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Order Date:</span>
                                        <span class="field-value">${escapeXml(formatDateUS(parameters.orderDate))}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Customer:</span>
                                        <span class="field-value">${escapeXml(parameters.entitynumber)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Buyer:</span>
                                        <span class="field-value">${escapeXml(parameters.buyer)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Prepared By:</span>
                                        <span class="field-value">${escapeXml(parameters.recordcreatedby)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Terms:</span>
                                        <span class="field-value">${escapeXml(parameters.terms)}</span>
                                    </div>
                                </td>
                                
                                <!-- COLUNA 2 -->
                                <td width="35%" class="info-cell info-divider">                               
                                    <div class="field">
                                        <span class="field-label">Delv Terms:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.delivery)}">${escapeXml(parameters.delivery)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Ship Via:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.shipVia)}">${escapeXml(parameters.shipVia)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Ship via acc:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.shipViaAcc)}">${escapeXml(parameters.shipViaAcc)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Ship Date:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.shipDate)}">${escapeXml(formatDateUS(parameters.shipDate))}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">AWB:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.awb)}">${escapeXml(parameters.awb)}</span>
                                    </div>                                
                                </td>
                                
                                <!-- COLUNA 3 -->
                                <td width="30%" class="info-cell info-divider">                              
                                    <div class="field">
                                        <span class="field-label">Number Of Items:</span>
                                        <span class="field-value">${escapeXml(arrayLength)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Number of Boxes:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.numberOfBoxes)}">${escapeXml(parameters.numberOfBoxes)}</span>
                                    </div>
                                
                                    <div class="field">
                                        <span class="field-label">Weight:</span>
                                        <span class="field-value" style="${getShipViaStyle(parameters.weight)}">${escapeXml(parameters.weight)}</span>
                                    </div>                             
                                </td>
                            
                            </tr>
                        </table>

                        <!-- Box Dimension -->
<table class="dimensions-wrapper">
    ${formatBoxDimensions(parameters.boxDimensions)}
</table>
                        
                        <!-- Itens -->                    
                        <table class="item-table">
                            <tr>
                                <th width="5%">Item</th>
                                <th width="46%">Part Number / Description</th>
                                <th width="7%" class="item-col-center">Shipped</th>
                                <th width="7%" class="item-col-center">Backord</th>
                                <th width="9%" class="item-col-center">CD</th>
                                <th width="10%" class="item-col-right">Unit Price</th>
                                <th width="6%" class="item-col-center">UOM</th>
                                <th width="10%" class="item-col-right">Total Amt</th>
                            </tr>
                        
                            <tr>
                                <td>${escapeXml(index + 1)}</td>
                        
                                <td>
                                    <table class="desc-table">
                                        <tr>
                                            <td colspan="2"><b>${escapeXml(itemArrayObject.itemName)}</b></td>
                                        </tr>
                                        ${createDynamicHtml(parameters, index)}
                                    </table>
                                </td>
                        
                                <td class="item-col-center">${escapeXml(itemArrayObject.quantity)}</td>
                                <td class="item-col-center">${escapeXml(itemArrayObject.quantityremaining)}</td>
                                <td class="item-col-center">${escapeXml(itemArrayObject.condition)}</td>
                                <td class="item-col-right">${escapeXml("$" + formatCurrency(itemArrayObject.unitPrice))}</td>
                                <td class="item-col-center">${escapeXml(itemArrayObject.UOM)}</td>
                                <td class="item-col-right">${escapeXml("$" + formatCurrency(itemArrayObject.totalAmount))}</td>
                            </tr>
                        </table>
                        
                        <!-- BLOCO FINAL -->
                        <table class="bottom-wrap">
                          <tr>
                        
                            <!-- ESQUERDA: SPECIAL + TERMS -->
                            <td class="col-left">
                        
                              <table class="box">
                                <tr>
                                  <td class="box-title">Special Instructions</td>
                                </tr>
                                <tr>
                                  <td class="box-body">
                                    ${escapeXml(parameters.specialInstructions)}
                                  </td>
                                </tr>
                              </table>
                        
                              <table style="width:100%; border-collapse:collapse;">
                                <tr><td class="box-spacer">&nbsp;</td></tr>
                              </table>
                        
                              <table class="box">
                                <tr>
                                  <td class="box-title">Terms and Conditions</td>
                                </tr>
                                <tr>
                                  <td class="box-body terms-body">
                                    ${termsCondition}
                                  </td>
                                </tr>
                              </table>
                        
                            </td>
                        
                            <!-- DIREITA: TOTALS -->
                            <td class="col-right">
                        
                              <table class="totals">
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Total NET Weight:</td>
                                  <td class="totals-val">${escapeXml(parameters.net)}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Total Gross Weight:</td>
                                  <td class="totals-val">${escapeXml(parameters.gross)}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">SubTotal:</td>
                                  <td class="totals-val">${escapeXml("$" + formatCurrency(parameters.subTotal))}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Tax Total:</td>
                                  <td class="totals-val">${escapeXml("$" + formatCurrency(parameters.taxtotal))}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Misc Charge:</td>
                                  <td class="totals-val">${escapeXml("$" + formatCurrency(parameters.miscChargeTotal))}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Freight:</td>
                                  <td class="totals-val">${escapeXml("$" + formatCurrency(parameters.freight))}</td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key"><b>Total:</b></td>
                                  <td class="totals-val"><b>${escapeXml("$" + formatCurrency(parameters.total))}</b></td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Payment Amt:</td>
                                  <td class="totals-val"></td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Payment Type:</td>
                                  <td class="totals-val"></td>
                                </tr>
                        
                                <tr class="totals-row">
                                  <td class="totals-key">Payment Owed:</td>
                                  <td class="totals-val"></td>
                                </tr>
                        
                               <tr class="totals-row totals-last">
  <td class="totals-key"><b>Payable in ${escapeXml(parameters.payableIn)}</b></td>
  <td class="totals-val"><b>${escapeXml("$" + formatCurrency(parameters.total))}</b></td>
</tr>
                        
                              </table>
                        
                            </td>
                        
                          </tr>
                          
                        </table>
                        
                        <table class="box" cellpadding="0" cellspacing="0">
                          <tr>
                            <td class="box-title">Signature</td>
                          </tr>
                          <tr>
                            <td class="box-body">
                              <table class="sign-area" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td class="sign-line">
                                    ${createDynamicSing(parameters)}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                           
                    </div>`);

            return html;
        }

        function escapeXml(str) {
            if (!str && str != "0") return '';
            return String(str)
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        function formatUrlForXml(url) {
            if (!url) return '';
            return String(url)
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function formatDateUS(isoDate) {
            if (!isoDate) return '';
            const date = new Date(isoDate);
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const year = date.getUTCFullYear();
            return month + '/' + day + '/' + year;
        }

        function formatTimeAMPM(timeStr) {
            if (!timeStr) return '';
            const parts = timeStr.split(':');
            let hours = parseInt(parts[0], 10);
            const mins = parts[1] || '00';
            const period = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return hours + ':' + mins + ' ' + period;
        }

        function formatCurrency(value) {
            if (!value && value !== 0) return '0.00';
            return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function createDynamicHtml(parameters, index) {
            let itemObjectIndex = parameters.invoiceItems[index];
            let dynamicHtml = '';

            if (itemObjectIndex.hasOwnProperty("partNumberVendor"))
                dynamicHtml += '<tr><td colspan="2">PN Vendor: ' + escapeXml(itemObjectIndex.partNumberVendor) + '</td></tr>';


            if (itemObjectIndex.hasOwnProperty("description") && itemObjectIndex.description)
                dynamicHtml += '<tr><td colspan="2">' + escapeXml(itemObjectIndex.description) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("inventoryNumber")) {
                dynamicHtml += '<tr><td colspan="2">Lot/Batch#: ' + escapeXml(itemObjectIndex["inventoryNumber"]) + '</td></tr>';
            }

            if (itemObjectIndex.hasOwnProperty("manufacturer"))
                dynamicHtml += '<tr><td colspan="2">MFG by: ' + escapeXml(itemObjectIndex.manufacturer) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("originCountry") && itemObjectIndex.originCountry)
                dynamicHtml += '<tr><td colspan="2">Country of Origin: ' + escapeXml(itemObjectIndex.originCountry) + '</td></tr>';

            if ((itemObjectIndex.hasOwnProperty("hsCode") && itemObjectIndex.hsCode) || (itemObjectIndex.hasOwnProperty("eccn") && itemObjectIndex.eccn))
                dynamicHtml += '<tr><td colspan="2">HS Code: ' + escapeXml(itemObjectIndex.hsCode || '') + ' - ECCN: ' + escapeXml(itemObjectIndex.eccn || '') + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("scheduleB"))
                dynamicHtml += '<tr><td colspan="2">Schedule B: ' + escapeXml(itemObjectIndex.scheduleB) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("manuAdress"))
                dynamicHtml += '<tr><td colspan="2">Manufacturer Address: ' + escapeXml(itemObjectIndex.manuAdress) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("customerReference"))
                dynamicHtml += '<tr><td colspan="2">Customer Reference: ' + escapeXml(itemObjectIndex.customerReference) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("hazMat"))
                dynamicHtml += '<tr><td colspan="2">HazMat: ' + escapeXml(itemObjectIndex.hazMat) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("itemNotes") && itemObjectIndex.itemNotes)
                dynamicHtml += '<tr><td colspan="2">Item Notes: ' + escapeXml(itemObjectIndex.itemNotes) + '</td></tr>';

            if (itemObjectIndex.hasOwnProperty("trace") && itemObjectIndex.trace)
                dynamicHtml += '<tr><td colspan="2">Item Trace: ' + escapeXml(itemObjectIndex.trace) + '</td></tr>';

            return dynamicHtml;
        }

        function createDynamicSing(parameters) {
            if (parameters.signature) {
                return '<img class="sign-img" src="' + formatUrlForXml(parameters.signature) + '" alt="Signature"/>';
            } else {
                return '<span>    </span>';
            }
        }

        function getShipViaStyle(value) {
            if (!value) return '';
            if (value.length > 20 && value.length <= 30) return 'font-size: 7pt;';
            if (value.length > 30) return 'font-size: 6pt;';
            return '';
        }

        function formatAddress(str) {
            if (!str) return '';
            return String(str)
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;')
                .replace(/\n/g, '<br/>')
        }

        function formatBoxDimensions(str) {
            if (!str) return '<tr><td style="width:15%;" class="dimensions-cell dimensions-label">Box Dimensions:</td><td class="dimensions-cell"></td></tr>';
            const boxes = str.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
            return boxes.map(function (s, i) {
                const labelCell = i === 0
                    ? '<td style="width:15%; vertical-align:top;" class="dimensions-cell dimensions-label">Box Dimensions:</td>'
                    : '<td style="width:15%;" class="dimensions-cell"></td>';
                const valueCell = '<td style="width:85%; vertical-align:top;" class="dimensions-cell">' + String(s)
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;') + '</td>';
                return '<tr>' + labelCell + valueCell + '</tr>';
            }).join('');
        }

        return handler;

    });
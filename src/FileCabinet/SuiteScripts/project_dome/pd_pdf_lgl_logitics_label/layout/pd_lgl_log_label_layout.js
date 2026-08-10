/**
 * @NApiVersion 2.1
 */
define([],

    () => {

        const handler = {}

        handler.getXml = (parameters) => {

            let html = "";

            log.debug({
                title: "Parameters",
                details: parameters
            })

            parameters.forEach((result, index) => {

                const barcodeValue = sanitizeBarcodeValue(
                    result.notes_invoice && result.pn
                        ? `${result.notes_invoice}_${result.pn}`
                        : (result.notes_invoice || result.pn || '0')
                );

                html += `<div style="
                            width:300pt;
                            height:300pt;
                            font-family:Courier;
                            font-size:8pt;
                            page-break-after: always;
                        ">
                        
                            <table style="width:100%; margin-top:2pt;">
                                <tr>
                                    <td colspan="2" class="align_center">
                                        <barcode
                                            codetype="code128"
                                            showtext="false"
                                            value="${barcodeValue}"
                                            height="15pt"
                                            width="275pt"
                                        />
                                    </td>
                                </tr>
                                <tr class="margin_top">
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">PN:</span> ${escapeXml(result.pn)}
                                    </td>
                                </tr>
                                 <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">DESC:</span> ${escapeXml(result.description)}
                                    </td>
                                </tr>
                                 <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">SN:</span> ${result.is_serie === "T" ? escapeXml(result.sn) : "N/A"}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">MFG CODE:</span> ${escapeXml(result.manufacturer)}
                                    </td>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">PO:</span> ${escapeXml(result.po_number)}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">COND:</span> ${escapeXml(result.cond)}
                                    </td>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">REC. DATE:</span> ${result.rec_date || ""}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">UOM:</span> ${escapeXml(result.uom)}
                                    </td>
                                    <td class="font_medium align_left">
                                        <span class="bold-text">MFG LOT#:</span> ${result.is_serie === "F" ? escapeXml(result.sn) : "N/A"}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">LOCATION:</span> ${escapeXml(result.location)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">RECEIVER #:</span> ${escapeXml(result.receiver)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">EXP DATE:</span> ${result.exp_date || "N/A"}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">TAGGED BY:</span> ${escapeXml(result.tagged_by)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">CERT SOURCE:</span> ${escapeXml(result.tagged_by)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" class="font_medium align_left">
                                        <span class="bold-text">REMARK:</span> ${escapeXml(result.remark)}
                                    </td>
                                </tr>
                            </table>
                            
                            <table style="width:100%; margin-top:8pt;">
                                <tr>
                            
                                    <td width="70pt" valign="top">
                            
                                        <barcode
                                            codetype="code128"
                                            showtext="false"
                                            value="${escapeXml(formatQuantity(result.qty))}"
                                            height="10pt"
                                            width="50pt"
                                        />

                                        <div class="font_medium">
                                            <span class="bold-text">Qty:</span> ${escapeXml(formatQuantity(result.qty))}
                                        </div>
                            
                                    </td>
                            
                                    <td valign="top">

                                        <table style="width:210pt;">
                                            <tr>
                                        
                                                <td width="35pt" valign="top">
                                                    <span class="bold-text">Notes:</span>
                                                </td>
                                        
                                                <td style="
                                                    border:0.5pt solid black;
                                                    padding:3pt;
                                                    font-size:6pt;
                                                ">
                                                    <span class="bold-text">Customer:</span> ${escapeXml(result.notes_customer)}<br/>
                                                    <span class="bold-text">PO:</span> ${escapeXml(result.notes_po)}<br/>
                                                    <span class="bold-text">INV:</span> ${escapeXml(result.notes_invoice)}
                                                </td>
                                        
                                            </tr>
                                        </table>
                            
                                    </td>
                            
                                </tr>
                            </table>
                        </div>`


            });

            return (`<?xml version="1.0"?>
                <!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
                    <pdf>
                    <head>
                        <style type="text/css">
                        
                            body {
                                font-family: Helvetica, sans-serif;
                                font-size: 7.5pt;
                                padding: 10pt;
                            }
                            
                            td {
                                padding:0
                            }
                         
                            .font_medium {
                                font-size:6pt
                            }
                        
                            .font_big {
                                font-size:7pt
                            }
                            
                            .align_left {
                                text-align:left
                            }
                            
                            .align_center {
                                text-align:center
                            }
                            
                            .bold-text {
                                font-weight: bold; 
                            }
                            
                            .margin_top {
                                margin-top: 8pt;
                            }
                            
                        </style>
                    </head>
                    
                    <body size="300pt 200pt">
                    ${html}
                    </body>
                    
            </pdf>`);

        }

        function escapeXml(str) {
            if (!str && str != "0") return '';
            return String(str)
                .toUpperCase()          // uppercase ANTES de escapar
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        // Round Half Up (ex.: 86.4362 -> 86.44 / 86.4321 -> 86.43). toPrecision(15) remove ruído de ponto flutuante antes do Math.round.
        function roundHalfUp(value, decimals) {
            const num = Number(value);
            if (isNaN(num)) return value;
            const factor = Math.pow(10, decimals);
            return Math.round(Number((num * factor).toPrecision(15))) / factor;
        }

        function formatQuantity(value) {
            if (value === '' || value === null || value === undefined) return '';
            return roundHalfUp(value, 2).toFixed(2);
        }

        function sanitizeBarcodeValue(str) {
            if (!str) return '';
            return String(str)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/[^A-Z0-9\-_\/\. ]/g, '');
        }

        return handler;

    });

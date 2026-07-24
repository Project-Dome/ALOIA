/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * Author: Lucas Monaco (+ ajustes de segmentação)
 */
define(['N/record', 'N/log', 'N/render', 'N/format', 'N/file', 'N/runtime', 'N/search'],
    function (record, log, render, format, file, runtime, search) {

        // Campo de fornecedor em linha
        var COL_VENDOR_ON_LINE = 'custcol_aae_vendor_purchase_order';
        // Campo de status em linha (select). Usaremos o VALUE (ID interno), não o texto.
        var COL_STATUS_ON_LINE = 'custcol_pd_aae_status_item';

        // Grupo de status
        var GROUP_NEW = 'new';      // somente ID interno = '1'
        var GROUP_OTHERS = 'others';  // IDs 2..5 (New Surplus, Used, Repaired, Overhauled)

        function getImageUrl(fileId) {
            try {
                var fileObj = file.load({id: fileId});
                var url = fileObj.url || '';
                return url.replace(/&/g, '&amp;');
            } catch (e) {
                log.error('Erro ao carregar arquivo', e);
                return '';
            }
        }

        function readEmployeeSignatureAndName(userId) {
            var sigUrl = '';
            var empName = '';
            try {
                var emp = record.load({type: record.Type.EMPLOYEE, id: userId});
                var signatureFileId = emp.getValue({fieldId: 'custentity_pd_aae_signature'});
                sigUrl = signatureFileId ? getImageUrl(signatureFileId) : '';
                var first = emp.getValue({fieldId: 'firstname'}) || '';
                var mid = emp.getValue({fieldId: 'middlename'}) || '';
                var last = emp.getValue({fieldId: 'lastname'}) || '';
                empName = (first + ' ' + mid + ' ' + last).replace(/\s+/g, ' ').trim();
            } catch (e) {
                log.error('Erro employee', e);
            }
            return {signatureUrl: sigUrl, employeeName: empName};
        }

        function getVendorName(vendorId) {
            if (!vendorId) return '';
            try {
                var vRec = record.load({type: record.Type.VENDOR, id: vendorId});
                return vRec.getValue({fieldId: 'companyname'}) || '';
            } catch (e) {
                return '';
            }
        }

        function getSubsidiaryData(subsidiaryId) {
            if (!subsidiaryId) return {name: '', address: ''};
            try {
                var s = record.load({type: record.Type.SUBSIDIARY, id: subsidiaryId});
                return {
                    name: s.getText({fieldId: 'name'}) || '',
                    address: (s.getValue({fieldId: 'mainaddress_text'}) || '')
                };
            } catch (e) {
                return {name: '', address: ''};
            }
        }

        function getAckFromCreatedFrom(invoice) {
            var createdFromId = invoice.getValue({fieldId: 'createdfrom'}) || '';
            if (!createdFromId) return '';
            try {
                var so = record.load({type: record.Type.SALES_ORDER, id: createdFromId});
                return so.getValue({fieldId: 'transactionnumber'}) || '';
            } catch (e) {
                return '';
            }
        }

        // Monta o "plano" de geração: grupos por (vendorId, grupoStatus)
        function planGroups(invoice) {
            var lineCount = invoice.getLineCount({sublistId: 'item'}) || 0;
            var groupsMap = {}; // key: vendorId||'' + '|' + group  -> { vendorId, group, vendorName, count }
            for (var i = 0; i < lineCount; i++) {
                var vendorId = invoice.getSublistValue({sublistId: 'item', fieldId: COL_VENDOR_ON_LINE, line: i}) || '';
                var statusVal = String(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: COL_STATUS_ON_LINE,
                    line: i
                }) || '').trim();
                var group = (statusVal === '1') ? GROUP_NEW : GROUP_OTHERS; // 1 = New; resto = others

                var key = String(vendorId) + '|' + group;
                if (!groupsMap[key]) {
                    groupsMap[key] = {
                        vendorId: vendorId ? String(vendorId) : '',
                        group: group,
                        vendorName: getVendorName(vendorId),
                        count: 0
                    };
                }
                groupsMap[key].count++;
            }
            // Se não houver linhas, ainda devolve um grupo vazio (opcional). Aqui, retornamos apenas existentes.
            return Object.keys(groupsMap).map(function (k) {
                return groupsMap[k];
            });
        }

        // Coleta linhas filtradas por vendorId + group (new/others)
        function collectLines(invoice, vendorIdFilter, groupFilter) {
            var lineCount = invoice.getLineCount({sublistId: 'item'}) || 0;
            var rows = [];

            for (var i = 0; i < lineCount; i++) {

                var vendorOnLine = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: COL_VENDOR_ON_LINE,
                    line: i
                }) || '';

                var statusVal = String(invoice.getSublistValue({
                    sublistId: 'item', fieldId: COL_STATUS_ON_LINE, line: i
                }) || '').trim();

                var group = (statusVal === '1') ? GROUP_NEW : GROUP_OTHERS;

                // Filtra por vendor
                if (vendorIdFilter && String(vendorOnLine) !== String(vendorIdFilter)) continue;
                // Filtra por grupo de status
                if (groupFilter && group !== groupFilter) continue;

                var description = invoice.getSublistValue({sublistId: 'item', fieldId: 'description', line: i}) || '';
                var quantity = invoice.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}) || '';
                var statusTxt = invoice.getSublistText({sublistId: 'item', fieldId: COL_STATUS_ON_LINE, line: i}) || '';
                var manufId = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_aae_manufacturer',
                    line: i
                }) || '';

                var conversionFactor = Number(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_measurement_conversion',
                    line: i
                })) || 1;

                var manufacturerName = '';
                if (manufId) {
                    try {
                        var mRec = record.load({type: record.Type.VENDOR, id: manufId});
                        manufacturerName = mRec.getValue({fieldId: 'companyname'}) || '';
                    } catch (e) {
                    }
                }

                var partNumber = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbercustomer_display',
                    line: i
                }) || '';
                var vendorPartNumber = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbervendor',
                    line: i
                }) || '';
                var poNumber = invoice.getSublistText({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_purchaseorder',
                    line: i
                }) || '';

                try {

                    const inventoryDetailField = invoice.getSublistField({
                        sublistId: "item",
                        fieldId: "inventorydetail",
                        line: i
                    });

                    if (inventoryDetailField) {

                        var invDet = invoice.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: i
                        });

                        var assCount = invDet.getLineCount({sublistId: 'inventoryassignment'}) || 0;

                        if(assCount === 0) {

                            rows.push({
                                partNumber: partNumber,
                                vendorPartNumber: vendorPartNumber,
                                description: description,
                                quantity: quantity * conversionFactor,
                                statusText: statusTxt,
                                statusVal: statusVal,
                                manufacturerName: manufacturerName,
                                serialText: "",
                                lotText: "",
                                poNumber: poNumber
                            });

                        } else {

                            for (var a = 0; a < assCount; a++) {

                                var serialNum = invDet.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    line: a
                                }) || '';

                                var lotQuantity = Number(invDet.getSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    line: a
                                }));

                                if (serialNum) rows.push({
                                    partNumber: partNumber,
                                    vendorPartNumber: vendorPartNumber,
                                    description: description,
                                    quantity: lotQuantity * conversionFactor,
                                    statusText: statusTxt,
                                    statusVal: statusVal,
                                    manufacturerName: manufacturerName,
                                    serialText: serialNum,
                                    lotText: "",
                                    poNumber: poNumber
                                });

                            }

                        }

                    } else {

                        rows.push({
                            partNumber: partNumber,
                            vendorPartNumber: vendorPartNumber,
                            description: description,
                            quantity: quantity * conversionFactor,
                            statusText: statusTxt,
                            statusVal: statusVal,
                            manufacturerName: manufacturerName,
                            serialText: "",
                            lotText: "",
                            poNumber: poNumber
                        });

                    }

                } catch (e) {

                    log.error({
                        title: "ERROR IN - collectLines",
                        details: {
                            stack: e.stack,
                            message: e.message
                        }
                    });

                }

            }

            return rows;
        }

        function buildItemRowsXml(rows, codPo) {
            // Columns: Part No. | Description | Cond | Qty | S/L | Lot/Batch # | Cert No | PO Number
            var MIN_ROWS = 15; // minimum data rows — ensures table has enough rows to fill page
            var emptyRow =
                '<tr style="height: auto;">' +
                '<td class="col-left">&nbsp;</td>' +
                '<td class="col-left"></td>' +
                '<td class="col-center"></td>' +
                '<td class="col-center"></td>' +
                '<td class="col-center"></td>' +
                '<td class="col-center"></td>' +
                '<td class="col-center"></td>' +
                '</tr>';

            var xml = '';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                // Escape text first, then inject <br/> as literal markup (not escaped)
                var descEscaped = escapeXml(String(r.description || '').replace(/(?:\r\n|\r|\n)/g, '\n'));
                var descHtml = descEscaped.replace(/\n/g, '<br/>');
                var partCell = escapeXml(r.partNumber || '');
                var lotCell = r.serialText || '';
                xml += ''
                    + '<tr>'
                    + '<td class="col-left">' + partCell + '</td>'
                    + '<td class="col-left">' + descHtml + '</td>'
                    + '<td class="col-center">' + escapeXml(r.statusText || '') + '</td>'
                    + '<td class="col-center">' + escapeXml(r.quantity || '') + '</td>'
                    + '<td class="col-center">' + lotCell + '</td>'
                    + '<td class="col-center"></td>'  // Cert No
                    + '<td class="col-center">' + escapeXml(codPo) + '</td>'  // PO Number
                    + '</tr>';
            }

            // Pad with empty rows so table body fills available page space
            var padCount = Math.max(0, MIN_ROWS - rows.length);
            for (var p = 0; p < padCount; p++) {
                xml += emptyRow;
            }

            return xml;
        }

        function renderPdf(context, invoice, vendorIdFilter, groupFilter) {
            var sellerContract = invoice.getValue({fieldId: 'tranid'}) || '';
            var codPo = invoice.getValue({fieldId: 'otherrefnum'}) || '';
            var rawDate = invoice.getValue({fieldId: 'trandate'});
            var dateStr = rawDate ? format.format({value: rawDate, type: format.Type.DATE}) : '';
            var rawShipDate = invoice.getValue({fieldId: 'shipdate'});
            var shipDate = rawShipDate ? format.format({value: rawShipDate, type: format.Type.DATE}) : '';
            var billAddress = invoice.getValue({fieldId: 'billaddress'}) || '';
            var shipAddress = invoice.getValue({fieldId: 'shipaddress'}) || '';
            var awb = invoice.getValue({fieldId: 'custbody_pd_awb'}) || '';

            var userData = readEmployeeSignatureAndName(runtime.getCurrentUser().id);
            var signatureUrl = userData.signatureUrl;
            var employeeName = userData.employeeName;

            // Linhas do grupo atual (vendor + status)
            var rows = collectLines(invoice, vendorIdFilter, groupFilter);

            // Assinatura: mostra apenas se há URL e linhas neste grupo
            var showSignature = signatureUrl && rows.length > 0;

            var signatureCell = showSignature
                ? '<img src="' + signatureUrl + '" style="width: 200px; height: 40px; object-fit: contain; margin-top: 4px;"/>'
                : '';

            var signedNameCell = showSignature ? escapeXml(employeeName) : '';

            var pdfContent =
                '<?xml version="1.0"?>' +
                '<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">' +
                '<pdf>' +
                '<head>' +
                '  <style type="text/css">' +
                '    * { font-family: Arial, sans-serif; }' +
                '    table { font-size: 8pt; table-layout: fixed; }' +
                '    td    { font-size: 8pt; padding: 3px 5px; vertical-align: top; }' +
                '    th    { font-size: 8pt; font-weight: bold; padding: 4px 6px; vertical-align: middle; }' +

                // Header title block
                '    .coc-company { font-size: 14pt; font-weight: bold; font-style: italic; }' +
                '    .coc-title   { font-size: 13pt; font-weight: bold; }' +

                // Top-right number box
                '    table.num-box { width: 100%; border-collapse: collapse; border: 1.5px solid #000000; }' +
                '    table.num-box td { font-size: 9pt; padding: 3px 7px; border: 0px; }' +
                '    .num-label    { font-size: 7pt; text-align: right; letter-spacing: 1px; }' +
                '    .num-value    { font-size: 13pt; font-weight: bold; }' +
                '    .num-original { font-size: 9pt; font-weight: bold; text-align: center;' +
                '                    border-top: 1px solid #000000 !important; padding: 2px 7px !important; }' +

                // Address block
                '    table.addr-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.addr-table th { background-color: #ffffff; color: #000000; border-bottom: 1px solid #000000;' +
                '                          font-size: 8pt; text-align: left; padding: 3px 6px; }' +
                '    table.addr-table td { font-size: 8pt; padding: 6px 8px; line-height: 155%; vertical-align: top; }' +
                '    .addr-divider { border-left: 1px solid #000000; }' +

                // Meta row
                '    table.meta-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.meta-table th { background-color: #ffffff; color: #000000;' +
                '                          border: 1px solid #000000; font-size: 8pt;' +
                '                          text-align: center; padding: 4px 6px; }' +
                '    table.meta-table td { font-size: 8pt; text-align: center;' +
                '                          border: 1px solid #000000; padding: 5px 6px; }' +

                // Items table
                '    table.item-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.item-table th { background-color: #ffffff; color: #000000;' +
                '                          border: 0px; border-bottom: 1px solid #000000; font-size: 8pt;' +
                '                          text-align: center; padding: 2px 5px; }' +
                '    table.item-table td { font-size: 7.5pt; border: 0px;' +
                '                          padding: 2px 5px; vertical-align: top; }' +
                '    tr.spacer-row td   { height: 280px; border: 0px; padding: 0px; }' +
                '    .col-left   { text-align: left; }' +
                '    .col-center { text-align: center; }' +
                '    .col-right  { text-align: right; }' +

                // Certification statement
                '    table.cert-table { width: 100%; border-collapse: collapse;' +
                '                       border: 1px solid #000000; margin-top: 6px; }' +
                '    table.cert-table td { font-size: 8pt; padding: 8px 10px; line-height: 155%; }' +

                // Signature block
                '    table.sign-table { width: 100%; border-collapse: collapse;' +
                '                       border: 1px solid #000000; margin-top: 0px; }' +
                '    table.sign-table td { font-size: 8pt; padding: 6px 10px; vertical-align: top; }' +
                '    .sign-divider { border-left: 1px solid #000000; }' +
                '    .sign-label   { font-size: 7pt; color: #333333; }' +
                '    .sign-name    { font-size: 11pt; font-style: italic; color: #1a44a8;' +
                '                    border-bottom: 1px solid #000000; display: block;' +
                '                    padding-bottom: 2px; margin-bottom: 2px; width: 180px; }' +
                '  </style>' +
                '</head>' +

                '<body padding="0.45in 0.55in 0.45in 0.55in" size="Letter">' +

                // 1. PAGE HEADER — company name + title + number box
                '<table style="width: 100%; border-collapse: collapse; border: 0px;">' +
                '  <tr>' +
                '    <td style="width: 65%; vertical-align: bottom; padding: 0px;">' +
                '      <span class="coc-company">Aloia Aerospace Inc.</span><br/>' +
                '      <span class="coc-title">CERTIFICATE OF CONFORMITY</span>' +
                '    </td>' +
                '    <td style="width: 35%; vertical-align: top; padding: 0px 0px 0px 10px;">' +
                '      <table style="width: 100%; border: 0px; border-collapse: collapse;">' +
                '        <tr><td style="padding: 0px; text-align: right;">' +
                '          <span style="font-size: 8pt; font-weight: bold; letter-spacing: 2px;">SITA</span>' +
                '        </td></tr>' +
                '        <tr><td style="padding: 3px 0px 0px 0px;">' +
                '          <table class="num-box">' +
                '            <tr>' +
                '              <td class="num-label">No:</td>' +
                '              <td class="num-value">&nbsp;' + escapeXml(sellerContract) + '</td>' +
                '            </tr>' +
                '            <tr><td colspan="2" class="num-original">ORIGINAL</td></tr>' +
                '          </table>' +
                '        </td></tr>' +
                '      </table>' +
                '    </td>' +
                '  </tr>' +
                '</table>' +

                // 2. BILL TO / SHIP TO
                '<table class="addr-table">' +
                '  <tr>' +
                '    <th style="width: 50%;">Bill To:</th>' +
                '    <th style="width: 50%;" class="addr-divider">Ship To:</th>' +
                '  </tr>' +
                '  <tr>' +
                '    <td style="width: 50%; min-height: 60px;">' + escapeXml(billAddress).replace(/\n/g, '<br/>') + '</td>' +
                '    <td style="width: 50%; min-height: 60px;" class="addr-divider">' + escapeXml(shipAddress).replace(/\n/g, '<br/>') + '</td>' +
                '  </tr>' +
                '</table>' +

                // 3. META ROW — Customer PO / Ship Date / AWB
                '<table class="meta-table">' +
                '  <tr>' +
                '    <th style="width: 33%;">Customer PO</th>' +
                '    <th style="width: 34%;">Ship Date</th>' +
                '    <th style="width: 33%;">Airway Bill Number</th>' +
                '  </tr>' +
                '  <tr>' +
                '    <td style="width: 33%;">' + escapeXml(codPo) + '</td>' +
                '    <td style="width: 34%;">' + escapeXml(shipDate) + '</td>' +
                '    <td style="width: 33%;">' + escapeXml(awb) + '</td>' +
                '  </tr>' +
                '</table>' +

                // 4. ITEMS TABLE
                '<table class="item-table">' +

                '  <tr>' +
                '    <th style="width: 18%;" class="col-left">Part No.</th>' +
                '    <th style="width: 26%;" class="col-left">Description</th>' +
                '    <th style="width: 8%;"  class="col-center">Cond</th>' +
                '    <th style="width: 5%;"  class="col-center">Qty</th>' +
                '    <th style="width: 17%;" class="col-center">Lot/Serial #</th>' +
                '    <th style="width: 12%;" class="col-center">Cert No</th>' +
                '    <th style="width: 14%;" class="col-center">PO Number</th>' +
                '  </tr>' +

                buildItemRowsXml(rows, codPo) +

                '<tr class="spacer-row"><td colspan="8">&nbsp;</td></tr>' +

                // 5+6. CERT STATEMENT + SIGNATURE — pinned to bottom via tablefooter
                '<tablefooter>' +
                '  <tr>' +
                '    <td colspan="8" style="border: 0px; padding: 0px;">' +

                '      <table class="cert-table">' +
                '        <tr>' +
                '          <td>' +
                '            <b>We hereby certify that the parts in this shipment conform with applicable specifications' +
                '            and that documentation and/or data is on file and available for examination.</b>' +
                '          </td>' +
                '        </tr>' +
                '      </table>' +

                '      <table class="sign-table">' +
                '        <tr>' +
                '          <td style="width: 50%; vertical-align: bottom; padding: 10px 10px 6px 10px;">' +
                '            <span class="sign-label">Signed:</span><br/>' +
                (signatureCell ? '<span class="sign-name">' + signatureCell + '</span>' : '') +
                (signedNameCell ? '<span class="sign-name">' + signedNameCell + '</span>' : '') +
                '            <span style="font-size: 7.5pt;">For and on behalf of Aloia Aerospace Inc.</span>' +
                '          </td>' +
                '          <td style="width: 50%; vertical-align: bottom; padding: 10px 10px 6px 10px;" class="sign-divider">' +
                '            <span style="font-size: 7.5pt;">Inspectors Stamp</span>' +
                '          </td>' +
                '        </tr>' +
                '      </table>' +

                '    </td>' +
                '  </tr>' +
                '</tablefooter>' +

                '</table>' +

                '</body></pdf>';

            var pdfFile = render.xmlToPdf({xmlString: pdfContent});

            // Nome do arquivo
            var name = 'CofC';
            if (vendorIdFilter) {
                var vname = getVendorName(vendorIdFilter);
                if (vname) name += '_' + vname.replace(/[^\w\-]+/g, '_');
            }
            name += (groupFilter === GROUP_NEW ? '_NEW' : '_OTHERS');
            name += '.pdf';

            // Download
            context.response.setHeader({name: 'Content-Type', value: 'application/pdf'});
            context.response.setHeader({name: 'Content-Disposition', value: 'inline; filename="' + name + '"'});
            context.response.writeFile(pdfFile, true);
        }

        function escapeXml(s) {
            return String(s || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        }

        function onRequest(context) {
            if (context.request.method !== 'GET') return;

            var invoiceId = context.request.parameters.invoiceId;
            var action = context.request.parameters.action || '';
            var vendorId = context.request.parameters.vendorId || '';   // filtro fornecedor
            var group = context.request.parameters.group || '';      // 'new' | 'others'

            if (!invoiceId) {
                context.response.write('Missing invoiceId');
                return;
            }

            var invoice = record.load({type: record.Type.INVOICE, id: invoiceId, isDynamic: false});

            if (action === 'planGroups') {
                var plan = planGroups(invoice);
                context.response.setHeader({name: 'Content-Type', value: 'application/json; charset=utf-8'});
                context.response.write(JSON.stringify({groups: plan}));
                return;
            }

            var groupFilter = group === GROUP_OTHERS ? GROUP_OTHERS : GROUP_NEW;
            renderPdf(context, invoice, vendorId || '', groupFilter);
        }

        return {onRequest: onRequest};
    });
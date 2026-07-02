/**
 * @NApiVersion 2.1
 */
define([
        "N/file",
        "../../lib/xlsx.full.min"
    ],

    (file, XLSX) => {

        const handler = {}

        handler.getStatementFileContents = (fileId) => {

            const fileLoad = file.load({
                id: fileId,
            });

            return {
                fileContents: fileLoad.getContents(),
                fileName: fileLoad.name
            }

        }

        handler.convertStatementToNetsuite = (fileContent, folderId, fileName) => {

            const statementLines = getStatementLines(fileContent);

            const parsedLines = buildParsedLines(statementLines);

            const csvString = "Date (MM/DD/YYYY),Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,NS Internal Customer Id,NS Customer Name,Invoice Number(s)\n"
                + parsedLines.map(line => Object.values(line).map(escapeField).join(',')).join('\n');

            const parsedFileId = createParsedFile(csvString, fileName, folderId);

            return parsedFileId;

        }

        function getStatementLines(fileContent) {

            return fileContent
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .slice(7)
                .filter(line => line.trim() !== '')
                .map(line => parseCsvStatementLines(line));

        }

        function parseCsvStatementLines(line) {
            const fields = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const ch = line[i];

                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === ',' && !inQuotes) {
                    fields.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }

            fields.push(current);
            return fields;
        }

        function buildParsedLines(statementLines) {

            const parsedLines = [];

            statementLines.forEach((line, index) => {

                const [date, description, rawAmount] = line;

                if (!rawAmount || rawAmount.trim() === '') return null;

                const amount = _parseAmount(rawAmount);

                if (isNaN(amount)) return null;

                parsedLines.push({
                    'Date (MM/DD/YYYY)': date.trim(),
                    'Payer/Payee Name': description.trim().substring(0, 70),
                    'Transaction Id': String(parsedLines.length + 1),
                    'Transaction Type': _classifyTransaction(description, amount),
                    'Amount': amount,
                    'Memo': description.trim(),
                    'NS Internal Customer Id': '',
                    'NS Customer Name': '',
                    'Invoice Number(s)': '',
                });

            });

            return parsedLines;

        }

        const _parseAmount = (raw) => {
            return parseFloat(raw.trim().replace(/,/g, ''));
        }

        const _classifyTransaction = (description, amount) => {

            if (/ACCOUNT TRANSFER/i.test(description)) return 'TRANSFER';

            return amount >= 0 ? 'CREDIT' : 'DEBIT';
        }

        //TODO: USAR SOMENTE SE FOR SOLICITADO PELO CLIENTE.
        const _extractInvoiceNumbers = (description) => {

            const invoices = new Set();

            const invSlashMatch = description.match(/\/INV\/([\d,\s+]+?)(?:\+OTHERS|[A-Z]{4}|$)/i);
            if (invSlashMatch) {
                (invSlashMatch[1].match(/\d{4,}/g) || []).forEach(n => invoices.add(n));
            }

            const pmtDetMatch = description.match(/PMT DET:([\d\s/]{5,}?)(?=\s[A-Z]|PURPOSE|$)/i);
            if (pmtDetMatch) {
                (pmtDetMatch[1].match(/\b\d{5}\b/g) || []).forEach(n => invoices.add(n));
            }

            for (const m of description.matchAll(/\bINV\s+(\d{4,})/gi)) invoices.add(m[1]);

            for (const m of description.matchAll(/\bIN\s+V\s+(\d{4,})/gi)) invoices.add(m[1]);

            const pmtInfoMatch = description.match(/PMT INFO:(\d{4,})/i);
            if (pmtInfoMatch) invoices.add(pmtInfoMatch[1]);

            return [...invoices].join(', ');

        }

        const createParsedFile = (csvString, fileName, folderId) => {

            const baseName = fileName.replace(/\.(xlsx|csv)$/i, '');

            return file.create({
                name: `${baseName}_parsed.csv`,
                fileType: file.Type.PLAINTEXT,
                folder: folderId,
                contents: csvString,
            }).save();

        }

        const escapeField = (value) => {
            const s = typeof value === 'number'
                ? value.toFixed(2)
                : String(value ?? '');

            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        }

        handler.convertCashProXlsxToNetsuite = (fileContentBase64, folderId, fileName) => {

            const rawRows = getCashProRows(fileContentBase64);

            const parsedLines = buildCashProParsedLines(rawRows);

            log.debug({
                title: "parsedLines",
                details: parsedLines
            });

            const csvString = "Date (MM/DD/YYYY),Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,NS Internal Customer Id,NS Customer Name,Invoice Number(s)\n"
                + parsedLines.map(line => Object.values(line).map(escapeField).join(',')).join('\n');

            validateTotals(rawRows, parsedLines);

            return createParsedFile(csvString, fileName, folderId);

        };

        function getCashProRows(fileContentBase64) {

            log.debug({
                title: "XLSX",
                details: XLSX
            })

            const workbook = XLSX.read(fileContentBase64, {type: 'base64'});

            const sheetName = workbook.SheetNames.includes('CashPro')
                ? 'CashPro'
                : workbook.SheetNames[0];

            const sheet = workbook.Sheets[sheetName];
            const allRows = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: true, defval: ''});
            return allRows.slice(6).filter(row => row.some(cell => String(cell).trim() !== ''));

        }

        const COL = {
            DATE: 1,
            ROW_TYPE: 8,
            DATA_TYPE: 9,
            BAI_DESC: 11,
            AMOUNT: 12,
            BANK_REFERENCE: 15,
            TEXT: 19
        };

        function buildCashProParsedLines(rawRows) {

            const parsedLines = [];

            rawRows.forEach((row) => {

                const rowType = String(row[COL.ROW_TYPE] || '').trim();
                const dataType = String(row[COL.DATA_TYPE] || '').trim();

                if (rowType === 'Total') return;
                if (dataType === 'Summary') return;

                const bankReference = String(row[COL.BANK_REFERENCE] || '').trim();
                const rawAmount = row[COL.AMOUNT];

                if (rawAmount === '' || rawAmount === null || rawAmount === undefined) return;

                const amount = _parseCashProAmount(rawAmount, dataType);
                if (isNaN(amount)) return;

                const baiDescription = String(row[COL.BAI_DESC] || '').trim();
                const text = String(row[COL.TEXT] || '').trim();

                parsedLines.push({
                    'Date (MM/DD/YYYY)': _formatCashProDate(row[COL.DATE]),
                    'Payer/Payee Name': extractPayeeName(text, baiDescription).substring(0, 70),
                    'Transaction Id': bankReference.substring(0, 90),
                    'Transaction Type': classifyCashProTransaction(baiDescription, text),
                    'Amount': amount,
                    'Memo': buildCashProMemo(baiDescription, text).substring(0, 4000),
                    'NS Internal Customer Id': '',
                    'NS Customer Name': '',
                    'Invoice Number(s)': '',
                });

            });

            return parsedLines;

        }

        const _parseCashProAmount = (raw, dataType) => {

            const value = parseFloat(String(raw).replace(/,/g, ''));
            if (isNaN(value)) return NaN;

            const sign = dataType === 'Detail Debits' ? -1 : 1;

            return Math.round(value * sign * 100) / 100;

        };

        const MONTHS = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };

        function _formatCashProDate(rawDate) {

            const match = String(rawDate).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
            if (!match) return String(rawDate).trim();

            const [, day, monthAbbrev, year] = match;
            const month = MONTHS[monthAbbrev] || '01';
            const dayPadded = day.padStart(2, '0');

            return `${month}/${dayPadded}/${year}`;

        }

        const CORP_SUFFIXES = /\b(INCORPORATED|CORPORATION|COMPANY|LIMITED|INC|LLC|LTD|CORP|CO|PLC)\b/;
        const ADDRESS_HINTS = /\b(RUA|AVENIDA|AV|PO BOX|AEROPORT|STREET|ST|AVENUE|AVE|SUITE|DRIVE|ROAD)\b|\d/;

        function extractPayeeName(text, baiDescription) {

            const flat = text.replace(/\s+/g, ' ').trim();

            if (/ACCOUNT TRANSFER|TRSF FROM/i.test(flat) || /Individual Auto Transfer/i.test(baiDescription)) {
                const acctMatch = flat.match(/TRSF FROM (\d+)/i);
                return acctMatch
                    ? `Account Transfer - Internal (from acct ${acctMatch[1]})`
                    : 'Account Transfer - Internal';
            }

            const cdtrMatch = flat.match(/Cdtr Nm:\s*(.+?)\s*(?:Cdtr Bank|$)/i);
            if (cdtrMatch) return cdtrMatch[1].trim();

            const indnMatch = flat.match(/INDN:\s*(.+?)\s*(?:CO ID:|$)/i);
            if (indnMatch) return indnMatch[1].trim();

            const bnfMatch = flat.match(/BNF:\s*(.+?)\s*(?:BNF BK:|$)/i);
            if (bnfMatch) {
                return _cutBeneficiaryName(bnfMatch[1].trim());
            }

            const firstLine = text.split('\n')[0] || '';
            const cardMatch = firstLine.match(/^(?:CHECKCARD|PURCHASE)\s+\d{4}\s+(.+)$/i);
            if (cardMatch) return cardMatch[1].trim();

            return baiDescription;

        }

        function _cutBeneficiaryName(rawBeneficiary) {

            const suffixMatch = rawBeneficiary.match(CORP_SUFFIXES);
            if (suffixMatch) {
                const cutIndex = suffixMatch.index + suffixMatch[0].length;
                return rawBeneficiary.substring(0, cutIndex).trim();
            }

            const addressMatch = rawBeneficiary.match(ADDRESS_HINTS);
            if (addressMatch) {
                return rawBeneficiary.substring(0, addressMatch.index).trim();
            }

            return rawBeneficiary.trim();

        }

        function classifyCashProTransaction(baiDescription, text) {

            const desc = baiDescription.toUpperCase();

            if (/ACH PREFUNDING/.test(desc)) return 'ACH';
            if (/REAL TIME PAYMENT/.test(desc)) return 'PAYMENT';
            if (/OUTGOING|INTERNATIONAL MONEY TRNSFR/.test(desc)) return 'TRANSFER';
            if (/INDIVIDUAL AUTO TRANSFER/.test(desc)) return 'TRANSFER';
            if (/ATM DEBIT/.test(desc) || /CHECKCARD|PURCHASE/i.test(text)) return 'PAYMENT';

            return 'OTHER';

        }

        function buildCashProMemo(baiDescription, text) {

            const flat = text.replace(/\s+/g, ' ').trim();

            let reference = '';

            const relatedRefMatch = flat.match(/RELATED REF:\s*(.+?)\s*(?:ORIG:|$)/i);
            const dbtrRefMatch = flat.match(/Dbtr Client Ref:\s*(.+?)\s*(?:Cdtr Nm:|$)/i);
            const popMatch = flat.match(/\/POP\s+(.+?)\s*(?:UETR:|$)/i);

            if (relatedRefMatch) reference = relatedRefMatch[1].trim();
            else if (dbtrRefMatch) reference = dbtrRefMatch[1].trim();
            else if (popMatch) reference = popMatch[1].trim();

            const memo = reference ? `${baiDescription} - ${reference}` : baiDescription;

            return memo.replace(/[,;_]/g, ' ').replace(/\s+/g, ' ').trim();

        }

        function validateTotals(rawRows, parsedLines) {

            const totalCreditsRow = rawRows.find(r =>
                String(r[COL.ROW_TYPE]).trim() === 'Total' && String(r[COL.DATA_TYPE]).trim() === 'Detail Credits');
            const totalDebitsRow = rawRows.find(r =>
                String(r[COL.ROW_TYPE]).trim() === 'Total' && String(r[COL.DATA_TYPE]).trim() === 'Detail Debits');

            const expectedCredits = totalCreditsRow ? parseFloat(totalCreditsRow[COL.AMOUNT]) : 0;
            const expectedDebits = totalDebitsRow ? parseFloat(totalDebitsRow[COL.AMOUNT]) : 0;

            const sumPositive = parsedLines.filter(l => l.Amount > 0).reduce((acc, l) => acc + l.Amount, 0);
            const sumNegative = Math.abs(parsedLines.filter(l => l.Amount < 0).reduce((acc, l) => acc + l.Amount, 0));

            const round2 = (n) => Math.round(n * 100) / 100;

            if (round2(sumPositive) !== round2(expectedCredits)) {
                log.error({
                    title: 'CashPro import - divergência em Detail Credits',
                    details: `Esperado: ${expectedCredits} | Calculado: ${sumPositive}`
                });
            }

            if (round2(sumNegative) !== round2(expectedDebits)) {
                log.error({
                    title: 'CashPro import - divergência em Detail Debits',
                    details: `Esperado: ${expectedDebits} | Calculado: ${sumNegative}`
                });
            }

        }


        return handler;

    });

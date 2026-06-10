/**
 * @NApiVersion 2.1
 */
define([
        "N/file"
    ],

    (file) => {

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
                    'Date (MM/DD/YYYY)'      : date.trim(),
                    'Payer/Payee Name'       : description.trim().substring(0, 70),
                    'Transaction Id'         : String(parsedLines.length + 1),
                    'Transaction Type'       : _classifyTransaction(description, amount),
                    'Amount'                 : amount,
                    'Memo'                   : description.trim(),
                    'NS Internal Customer Id': '',
                    'NS Customer Name'       : '',
                    'Invoice Number(s)'      : '',
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

            return file.create({
                name: `${fileName.split(".csv")[0]}_parsed.csv`,
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

        return handler;

    });

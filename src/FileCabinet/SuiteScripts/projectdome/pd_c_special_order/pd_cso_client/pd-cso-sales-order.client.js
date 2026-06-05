/**
 * @NApiVersion     2.1
 * @NScriptType     ClientScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */


define(['N/ui/message', 'N/runtime'], function (message, runtime) {

    let _originalLineValues = {};
    let _protectedLines = [];

    function isAdmin() {
        let _roleId = runtime.getCurrentUser().role;
        return _roleId === 3;
    }

    function lineInit(context) {
        if (context.sublistId !== 'item') {
            return true;
        }

        // if (isAdmin()) {
        //     return;
        // }

        let _currentRecord = context.currentRecord;

        _originalLineValues = {
            item: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }),
            quantity: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' }),
            rate: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' }),
            amount: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' }),
            custcol_aae_purchaseorder: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_aae_purchaseorder' }),
            lineReference: _currentRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_cso_line_reference' })
        };

        let poValue = _originalLineValues.custcol_aae_purchaseorder;
        let lineRef = _originalLineValues.lineReference;

        if (poValue && lineRef) {
            // Evita duplicidade
            let alreadyTracked = _protectedLines.some(function (line) {
                return line.lineReference === lineRef;
            });

            if (!alreadyTracked) {
                _protectedLines.push({
                    lineReference: lineRef,
                    purchaseOrder: poValue
                });
            }
        }

    }

    function fieldChanged(context) {

        if (context.sublistId !== 'item') {
            return true;
        }

        // if (isAdmin()) {
        //     return;
        // }

        let _currentRecord = context.currentRecord;

        let _poValue = _currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_aae_purchaseorder'
        });

        if (_poValue) {
            let _blockedFields = ['item', 'quantity', 'rate', 'amount', 'custcol_aae_purchaseorder'];

            if (_blockedFields.indexOf(context.fieldId) !== -1) {
                let _originalValue = _originalLineValues[context.fieldId];

                _currentRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: context.fieldId,
                    value: _originalValue,
                    ignoreFieldChange: true
                });

                message.create({
                    title: "Warning",
                    message: "This line is linked to a Purchase Order and cannot be edited.",
                    type: message.Type.WARNING
                }).show();

                alert('This field cannot be changed because the line is linked to a Purchase Order.');
            }
        }

        return true;
    }

    function validateField(context) {
        if (context.sublistId !== 'item') {
            return true;
        }

        // if (isAdmin()) {
        //     return true;
        // }

        let _currentRecord = context.currentRecord;

        let _poValue = _currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_aae_purchaseorder'
        });

        if (_poValue && context.fieldId === 'custcol_aae_purchaseorder') {
            alert('This field cannot be modified because it is already linked to a Purchase Order.');
            return false;
        }

        return true;
    }

    function validateDelete(context) {
        if (context.sublistId !== 'item') {
            return true;
        }

        // if (isAdmin()) {
        //     return true;
        // }

        let _currentRecord = context.currentRecord;

        let _poValue = _currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_aae_purchaseorder'
        });

        if (_poValue) {
            alert('You cannot delete a line that is linked to a Purchase Order.');
            return false;
        }

        return true;
    }

    function saveRecord(context) {
        let _currentRecord = context.currentRecord;
        let numLines = _currentRecord.getLineCount({ sublistId: 'item' });

        let currentLineReferences = [];

        // Captura os lineReference atuais da sublista item
        for (let i = 0; i < numLines; i++) {
            let lineRef = _currentRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_pd_cso_line_reference',
                line: i
            });

            if (lineRef) {
                currentLineReferences.push(lineRef);
            }
        }

        // Compara com snapshot das linhas protegidas
        let deletedProtectedLine = _protectedLines.find(function (line) {
            return !currentLineReferences.includes(line.lineReference);
        });

        if (deletedProtectedLine) {
            alert('Você não pode remover uma linha vinculada a uma Purchase Order.');
            return false;
        }

        return true;
    }

    function pageInit(context) {
        try {
            let _salesOrderObj = context.currentRecord;
            let _hasPoLinkedLine = false;
            let _maxAttempts = 40;
            let _attempt = 0;

            // Verifica se existe pelo menos uma linha com PO vinculada
            let _lineCount = _salesOrderObj.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < _lineCount; i++) {
                let _poValue = _salesOrderObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_purchaseorder',
                    line: i
                });

                if (_poValue) {
                    _hasPoLinkedLine = true;
                    break;
                }
            }

            // Se há PO, tenta localizar e desabilitar o botão até 4 segundos (100ms * 40)
            if (_hasPoLinkedLine) {
                let _interval = setInterval(function () {
                    let _clearAllButton = document.getElementById('clearsplitsitem');
                    _attempt++;

                    if (_clearAllButton) {
                        _clearAllButton.setAttribute('disabled', true);
                        _clearAllButton.style.opacity = 0.5;
                        _clearAllButton.title = 'Disabled: Some item lines are linked to a Purchase Order.';

                        // Adiciona alerta mesmo com botão desabilitado
                        // _clearAllButton.addEventListener('click', function () {
                        //     alert('Este botão está desabilitado porque há linhas vinculadas a uma Purchase Order.');
                        // });

                        clearInterval(_interval);
                    }

                    if (_attempt >= _maxAttempts) {
                        clearInterval(_interval);
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Erro no pageInit:', error);
        }
    }


    return {
        pageInit: pageInit,
        lineInit: lineInit,
        fieldChanged: fieldChanged,
        validateField: validateField,
        validateDelete: validateDelete,
        saveRecord: saveRecord
    };
});

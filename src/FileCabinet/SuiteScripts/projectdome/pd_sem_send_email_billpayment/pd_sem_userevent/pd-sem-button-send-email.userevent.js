/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues

 */

define(
    [
        'N/ui/serverWidget',
        'N/runtime'
    ],
    function
        (
            serverWidget,
            runtime

        ) {

        function beforeLoad(context) {

            const form = context.form;
            const type = context.type;

            const newRecord = context.newRecord;

            // Só adiciona o botão ao visualizar o registro
            if (type !== context.UserEventType.VIEW) {
                return;
            }

            // Identifica o tipo de registro
            const recordType = newRecord.type;

            // Verifica se é um dos tipos suportados
            if (recordType === 'vendorpayment' || recordType === 'customerpayment') {

                // Adiciona o botão
                form.addButton({
                    id: 'custpage_send_payment_email',
                    label: 'Send Payment Confirmation',
                    functionName: 'onSendPaymentEmailClick'
                });

                // Define o caminho do Client Script (ainda a ser implementado)
                form.clientScriptModulePath = "../pd_sem_client/pd-sem-send-email.client.js";
            }
        }

        return {
            beforeLoad: beforeLoad
        };
    });

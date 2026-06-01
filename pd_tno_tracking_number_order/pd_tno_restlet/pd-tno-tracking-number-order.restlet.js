/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 *@author Project Dome - Rogério Gonçalves Rodrigues
 */



define(
    [
        'N/log',
        '../pd_tno_service/pd-tno-parse-webhook-payload.service',
        '../pd_tno_service/pd-tno-track-notification-query.service',
        '../pd_tno_service/pd-tno-track-notification-update.service',
        '../pd_tno_service/pd-tno-build-track-notification-payload.service'
    ],
    function (
        log,
        parse_webhook_service,
        track_notification_query_service,
        track_notification_update_service,
        build_payload_service
    ) {

        function doPost(payload) {
            var logTitle = 'RESTlet 17TRACK';

            try {
                log.debug(logTitle, payload);

                if (!payload || !payload.data) {
                    throw new Error('Payload inválido (sem data)');
                }

                // 1) Parse do webhook (historical já vem como STRING)
                var parsed = parse_webhook_service.parseWebhookPayload(payload.data);

                if (!parsed || !parsed.trackingNumber || !parsed.carrier) {
                    throw new Error('Tracking number ou carrier ausente');
                }

                // 2) Busca o custom record (retorna { exists, notificationId })
                var existsResult = track_notification_query_service.existsNotification(
                    // parsed.carrier,
                    parsed.trackingNumber
                );

                log.debug(logTitle, 'existsNotification result: ' + JSON.stringify(existsResult));

                var notificationId =
                    existsResult && existsResult.notificationId
                        ? existsResult.notificationId
                        : null;

                if (!notificationId) {
                    throw new Error('Tracking Notification não encontrada');
                }

                // 3) Monta payload com fieldIds corretos (padrão UE)
                var payloadUpdate = build_payload_service.buildPayload({
                    status: parsed.status,
                    statusDate: parsed.statusDate,
                    estimatedDeliveryDate: parsed.estimatedDeliveryDate,
                    historicalData: parsed.historical
                });

                // 🔒 REGRA: se a 17Track vier sem estimated_delivery_date, NÃO atualizar o campo no custom record
                if (
                    parsed.estimatedDeliveryDate === null ||
                    parsed.estimatedDeliveryDate === undefined ||
                    parsed.estimatedDeliveryDate === ''
                ) {
                    delete payloadUpdate.custrecord_pd_tno_estimated_delivery_dat;
                }

                log.debug(logTitle, 'Payload para atualização: ' + JSON.stringify(payloadUpdate));

                // 4) Atualiza custom record
                track_notification_update_service.updateSingleNotification(
                    notificationId,
                    payloadUpdate
                );

                log.audit(logTitle, 'Notificação atualizada com sucesso: ' + notificationId);

                return { success: true, notificationId: notificationId };

            } catch (e) {
                log.error(logTitle, e);
                return { success: false, error: e.message };
            }
        }

        return { post: doPost };
    }
);

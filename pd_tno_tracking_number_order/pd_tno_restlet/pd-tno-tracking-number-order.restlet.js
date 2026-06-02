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

                // 2) Busca todos os custom records ativos para o tracking number
                var _notificationIds = track_notification_query_service.getAllActiveNotificationsByTrackingNumber(
                    parsed.trackingNumber
                );

                log.debug(logTitle, 'getAllActiveNotificationsByTrackingNumber result: ' + JSON.stringify(_notificationIds));

                if (!_notificationIds || _notificationIds.length === 0) {
                    throw new Error('Tracking Notification não encontrada');
                }

                // 3) Monta payload com fieldIds corretos (padrão UE)
                var _payloadUpdate = build_payload_service.buildPayload({
                    status: parsed.status,
                    statusDate: parsed.statusDate,
                    deliveryTo: parsed.estimatedDeliveryDate,
                    historicalData: parsed.historical
                });

                // REGRA: se a 17Track vier sem estimated_delivery_date, NÃO atualizar o campo no custom record
                if (
                    parsed.estimatedDeliveryDate === null ||
                    parsed.estimatedDeliveryDate === undefined ||
                    parsed.estimatedDeliveryDate === ''
                ) {
                    delete _payloadUpdate.custrecord_pd_tno_estimated_delivery_dat;
                }

                _payloadUpdate.custrecord_pd_tno_last_body = JSON.stringify(payload);

                log.debug(logTitle, 'Payload para atualização: ' + JSON.stringify(_payloadUpdate));

                // 4) Atualiza todos os custom records ativos encontrados
                var _notifications = _notificationIds.map(function (_id) {
                    return { notificationId: _id, payload: _payloadUpdate };
                });

                track_notification_update_service.updateTrackNotifications(_notifications);

                log.audit(logTitle, 'Notificações atualizadas com sucesso: ' + JSON.stringify(_notificationIds));

                return { success: true, notificationIds: _notificationIds };

            } catch (e) {
                log.error(logTitle, e);
                return { success: false, error: e.message };
            }
        }

        return { post: doPost };
    }
);

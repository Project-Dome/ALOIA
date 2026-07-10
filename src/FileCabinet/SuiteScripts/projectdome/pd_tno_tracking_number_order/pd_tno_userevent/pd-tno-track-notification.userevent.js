/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/log',

    '../pd_tno_service/pd-tno-track-notification-query.service.js',
    '../pd_tno_service/pd-tno-register-tracking-number.service.js',
    '../pd_tno_service/pd-tno-gettrackinfo.service.js',
    '../pd_tno_service/pd-tno-extract-track-historical.service.js',
    '../pd_tno_service/pd-tno-build-track-notification-payload.service.js',
    '../pd_tno_service/pd-tno-track-notification-update.service.js',
    '../pd_tno_service/pd-tno-extract-picked-up-date.service.js'

], function (
    log,

    trackNotificationQueryService,
    registerTrackingService,
    getTrackInfoService,
    historicalService,
    payloadService,
    updateService,
    pickedUpDateService
) {

    function afterSubmit(context) {
        try {
            if (
                context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT
            ) {
                return;
            }

            var notificationId = context.newRecord.id;

            if (!notificationId) {
                return;
            }

            // 1) Buscar dados do próprio customrecord_pd_tno_track_notification
            var trackingData = trackNotificationQueryService.getTrackNotificationData(notificationId);

            if (
                !trackingData ||
                !trackingData.notificationId ||
                !trackingData.trackingNumber ||
                !trackingData.carrierCode
            ) {
                log.debug('UE Track Notification', {
                    message: 'Dados insuficientes para processar tracking.',
                    trackingData: trackingData
                });

                if (trackingData && trackingData.notificationId && !trackingData.carrierCode) {
                    var _now = new Date();
                    var _mm = String(_now.getMonth() + 1).padStart(2, '0');
                    var _dd = String(_now.getDate()).padStart(2, '0');
                    var _yyyy = _now.getFullYear();
                    var _hh = String(_now.getHours()).padStart(2, '0');
                    var _min = String(_now.getMinutes()).padStart(2, '0');
                    var _historicalMessage = 'Carrier Code not registered - ' + _mm + '/' + _dd + '/' + _yyyy + ' - ' + _hh + ':' + _min;

                    var _payload = payloadService.buildPayload({
                        status: '',
                        deliveryTo: null,
                        historicalData: _historicalMessage
                    });

                    updateService.updateSingleNotification(trackingData.notificationId, _payload);
                }

                return;
            }

            var trackingNumber = trackingData.trackingNumber;
            var carrierCode = trackingData.carrierCode;

            log.debug('UE Track Notification - dados encontrados', trackingData);

            // 2) Registrar tracking na 17Track
            var registerResult = registerTrackingService.registerInboundTrackingNumber(
                trackingNumber,
                carrierCode
            );

            log.debug('UE Track Notification - registerResult', registerResult);

            if (!registerResult || !registerResult.success) {
                log.error('UE Track Notification - falha no registro 17Track', {
                    notificationId: notificationId,
                    trackingNumber: trackingNumber,
                    carrierCode: carrierCode,
                    result: registerResult
                });
                return;
            }

            var parsedBody = registerResult.parsedBody;

            if (!parsedBody || parsedBody.code !== 0) {
                log.error('UE Track Notification - retorno inválido 17Track', parsedBody);
                return;
            }

            // 3) Tentar obter track_info pelo retorno do register
            var accepted = parsedBody &&
                parsedBody.data &&
                parsedBody.data.accepted &&
                parsedBody.data.accepted[0];

            var trackInfo = accepted && accepted.track_info;


            //4) Se registrou com sucesso, mas não veio track_info no /register
            if (accepted && !trackInfo) {
                log.audit('UE Track Notification', {
                    message: 'Tracking registrado na 17Track, mas sem track_info no retorno.',
                    notificationId: notificationId,
                    trackingNumber: trackingNumber
                });

                var getTrackInfoAfterRegister = getTrackInfoService.getTrackInfo({
                    number: trackingNumber,
                    carrier: carrierCode
                });

                log.debug('UE Track Notification - getTrackInfo após register', getTrackInfoAfterRegister);

                var acceptedAfterRegister = getTrackInfoAfterRegister &&
                    getTrackInfoAfterRegister.data &&
                    getTrackInfoAfterRegister.data.accepted &&
                    getTrackInfoAfterRegister.data.accepted[0];

                trackInfo = acceptedAfterRegister && acceptedAfterRegister.track_info;

                // Se ainda não veio status, sinaliza que foi registrado
                if (!trackInfo) {
                    var registeredPayload = payloadService.buildPayload({
                        status: 'Registered',
                        deliveryTo: null,
                        historicalData: ''
                    });

                    updateService.updateSingleNotification(notificationId, registeredPayload);

                    log.audit('UE Track Notification', {
                        message: 'Tracking sinalizado como Registered.',
                        notificationId: notificationId
                    });

                    return;
                }
            }

            // 5) Tratar erros da 17Track + fallback para tracking já registrado
            if (!trackInfo) {
                var rejectedList = parsedBody &&
                    parsedBody.data &&
                    parsedBody.data.rejected
                    ? parsedBody.data.rejected
                    : [];

                if (rejectedList.length > 0) {
                    var firstError = rejectedList[0];

                    log.error('UE Track Notification - erro 17Track', {
                        notificationId: notificationId,
                        trackingNumber: trackingNumber,
                        carrierCode: carrierCode,
                        errorCode: firstError &&
                            firstError.error &&
                            firstError.error.code,
                        errorMessage: firstError &&
                            firstError.error &&
                            firstError.error.message,
                        fullRejected: rejectedList
                    });

                    // Fallback: tracking já registrado na 17Track
                    if (
                        firstError &&
                        firstError.error &&
                        firstError.error.code === -18019901
                    ) {
                        log.audit('UE Track Notification', 'Fallback getTrackInfo acionado.');

                        var getTrackInfoResult = getTrackInfoService.getTrackInfo({
                            number: trackingNumber,
                            carrier: carrierCode
                        });

                        log.debug('UE Track Notification - getTrackInfoResult', getTrackInfoResult);

                        var fallbackAccepted = getTrackInfoResult &&
                            getTrackInfoResult.data &&
                            getTrackInfoResult.data.accepted &&
                            getTrackInfoResult.data.accepted[0];

                        trackInfo = fallbackAccepted && fallbackAccepted.track_info;
                    }
                }
            }

            if (!trackInfo) {
                log.debug('UE Track Notification', {
                    message: 'Sem track_info para atualizar custom record.',
                    notificationId: notificationId,
                    trackingNumber: trackingNumber
                });
                return;
            }

            // 6) Histórico
            var milestones = trackInfo.milestone || [];
            var historicalData = historicalService.extractTrackHistorical(milestones);
            var pickedUpDate = pickedUpDateService.getPickedUpDate(milestones);

            // 7) Montar payload de atualização
            var payloadUpdate = payloadService.buildPayload({
                status: trackInfo.latest_status && trackInfo.latest_status.status
                    ? trackInfo.latest_status.status
                    : '',
                deliveryTo: trackInfo.time_metrics &&
                    trackInfo.time_metrics.estimated_delivery_date &&
                    trackInfo.time_metrics.estimated_delivery_date.to
                    ? trackInfo.time_metrics.estimated_delivery_date.to
                    : null,
                historicalData: historicalData,
                serviceType: trackInfo.misc_info && trackInfo.misc_info.service_type,
                providerServiceType: trackInfo.tracking && trackInfo.tracking.providers && trackInfo.tracking.providers[0] && trackInfo.tracking.providers[0].service_type,
                pickedUpDate: pickedUpDate
            });

            log.debug('UE Track Notification - payloadUpdate', payloadUpdate);

            // 8) Atualizar o próprio custom record
            updateService.updateSingleNotification(notificationId, payloadUpdate);

            log.audit('UE Track Notification', {
                message: 'Tracking Notification atualizado com sucesso.',
                notificationId: notificationId
            });

        } catch (error) {
            log.error('UE Track Notification - erro geral', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
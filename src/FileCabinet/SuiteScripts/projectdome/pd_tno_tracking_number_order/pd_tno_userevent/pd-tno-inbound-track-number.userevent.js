/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author      Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/log',
    'N/https',

    '../pd_tno_service/pd-tno-track-notification-query.service.js',
    '../pd_tno_service/pd-tno-build-track-notification-payload.service.js',
    '../pd_tno_service/pd-tno-track-notification-update.service.js',
    '../pd_tno_service/pd-tno-extract-track-historical.service.js',
    '../pd_tno_service/pd-tno-register-tracking-number.service.js',
    '../pd_tno_service/pd-tno-gettrackinfo.service.js',
    '../pd_tno_service/pd-tno-extract-picked-up-date.service.js'

], function (
    log,
    https,

    trackQueryService,
    payloadService,
    updateService,
    historicalService,
    registerTrackingService,
    getTrackInfoService,
    pickedUpDateService
) {

    const API_URL = 'https://api.17track.net/track/v2.4/register';
    const API_TOKEN = 'SEU_TOKEN_AQUI';

    function afterSubmit(context) {

        try {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }

            const inboundId = context.newRecord.id;
            if (!inboundId) {

                return;
            }


            // BUSCAR TRACKING VIA SERVICE (POR QUERY)
            const trackingData = trackQueryService.getInboundTrackingNotification(inboundId);

            if (!trackingData || !trackingData.notificationId || !trackingData.trackingNumber) {
                log.debug('UE Inbound', 'Sem tracking para processar.');
                return;
            }

            const notificationId = trackingData.notificationId;
            const trackingNumber = trackingData.trackingNumber;


            log.debug('UE Inbound - tracking encontrado', trackingData);

            // REGISTRAR NA 17TRACK (COM CARRIER)
            const carrierCode = trackingData.carrierCode;
            if (!carrierCode) {
                log.error('UE Inbound', 'Carrier Code ausente.');
                return;
            }

            const registerResult = registerTrackingService.registerInboundTrackingNumber(
                trackingNumber,
                carrierCode
            );

            log.debug('UE Inbound - registerResult', registerResult);

            if (!registerResult || !registerResult.success) {
                log.error('UE Inbound', {
                    message: 'Falha ao registrar tracking na 17Track',
                    notificationId: notificationId,
                    trackingNumber: trackingNumber,
                    result: registerResult
                });
                return;
            }

            log.audit('UE Inbound', {
                message: 'Tracking registrado na 17Track com sucesso',
                notificationId: notificationId,
                trackingNumber: trackingNumber
            });

            // TRATAR RETORNO DA 17TRACK
            const parsedBody = registerResult.parsedBody;

            if (!parsedBody || parsedBody.code !== 0) {
                log.error('UE Inbound - retorno inválido 17Track', parsedBody);
                return;
            }

            const accepted = parsedBody?.data?.accepted?.[0];
            let trackInfo = accepted?.track_info;

            // TRATAR ERROS DA 17TRACK
            

            if (!trackInfo) {

                const rejectedList = parsedBody?.data?.rejected || [];

                if (rejectedList.length > 0) {

                    const firstError = rejectedList[0];

                    log.error('UE Inbound - erro 17Track', {
                        trackingNumber: trackingNumber,
                        carrierCode: carrierCode,
                        errorCode: firstError?.error?.code,
                        errorMessage: firstError?.error?.message,
                        fullRejected: rejectedList
                    });

                    // FALLBACK - TRACKING JÁ EXISTENTE
                    if (firstError?.error?.code === -18019901) {

                        log.audit('UE Inbound', 'Fallback getTrackInfo acionado');

                        const getTrackInfoResult = getTrackInfoService.getTrackInfo({
                            number: trackingNumber,
                            carrier: carrierCode
                        });

                        const fallbackAccepted = getTrackInfoResult?.data?.accepted?.[0];
                        trackInfo = fallbackAccepted?.track_info;
                    }
                }
            }

            if (!trackInfo) {
                log.debug('UE Inbound - sem track_info no retorno');
                return;
            }

            // HISTÓRICO
            const milestones = trackInfo.milestone || [];
            const historical = historicalService.extractTrackHistorical(milestones);
            const pickedUpDate = pickedUpDateService.getPickedUpDate(milestones);

            // BUILD PAYLOAD
            const payloadUpdate = payloadService.buildPayload({
                status: trackInfo.latest_status?.status || '',
                deliveryTo: trackInfo.time_metrics?.estimated_delivery_date?.to || null,
                historicalData: historical,
                serviceType: trackInfo.misc_info?.service_type || null,
                providerServiceType: trackInfo.tracking?.providers?.[0]?.service_type || null,
                pickedUpDate: pickedUpDate
            });

            // payloadUpdate.custrecord_pd_tno_origin_transaction = inboundId;

            log.debug('UE Inbound - payloadUpdate', payloadUpdate);

            // UPDATE CUSTOM RECORD
            updateService.updateSingleNotification(notificationId, payloadUpdate);

            log.audit('UE Inbound', {
                message: 'Tracking Notification atualizado com sucesso',
                notificationId: notificationId
            });


        } catch (error) {
            log.error('UE Inbound - erro geral', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
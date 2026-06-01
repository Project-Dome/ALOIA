/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @author Rogério Gonçalves Rodrigues
 *
 */


define([
    'N/https',
    'N/record',
    'N/log',

    '../pd_tno_service/pd-tno-track-carriers.service',
    '../pd_tno_service/pd-tno-gettrackinfo.service.js',
    '../pd_tno_service/pd-tno-get-tracking-data.service.js',
    '../pd_tno_service/pd-tno-update-tracking-status-informations.service.js',
    '../pd_tno_service/pd-tno-register-return.service.js',
    '../pd_tno_service/pd-tno-po-tracking-columns.service.js',
    '../pd_tno_service/pd-tno-track-notification.service.js',
    '../pd_tno_service/pd-tno-track-notification-update.service.js',
    '../pd_tno_service/pd-tno-track-notification-params.service.js',
    '../pd_tno_service/pd-tno-track-notification-query.service.js',
    '../pd_tno_service/pd-tno-register-tracking-number.service.js',
    '../pd_tno_service/pd-tno-po-tracking-lines.service.js',
    '../pd_tno_service/pd-tno-track-notification-refresh.service.js',
    '../pd_tno_service/pd-tno-get-carrier-id-from-map.service',
    '../pd_tno_service/pd-tno-extract-track-historical.service.js',
    '../pd_tno_service/pd-tno-build-track-notification-payload.service.js',
    '../pd_tno_service/pd-tno-track-notification-active-check.service.js'

],
    function (
        https,
        record,
        log,

        carrier_service,
        gettrackinfo_service,
        gettrackdata_service,
        update_tracking_service,
        update_register_return_service,
        poTrackingColumns_service,
        track_notification_service,
        track_notification_update_service,
        track_notification_params_service,
        track_notification_query_service,
        register_tracking_number_service,
        tracking_lines_service,
        track_notification_refresh_service,
        get_carrier_id_service,
        historical_service,
        notification_payload_service,
        notification_active_check_service

    ) {

        const API_URL = 'https://api.17track.net/track/v2.4/register';
        // const GET_INFORMATION_URL = 'https://api.17track.net/track/v2.4/gettrackinfo';
        const API_TOKEN = '06DFC2BE751424BCF3B7EE9481C64058'; //Criar record type para armazenar valor.

        /**
        * beforeLoad - Refatorado
        */
        function beforeLoad(context) {
            try {
                if (context.type !== context.UserEventType.VIEW) return;

                var newRecord = context.newRecord;
                var poId = newRecord.id;
                if (!poId) return;

                var trackingLines = tracking_lines_service.getTrackingLines(poId);
                if (!trackingLines || trackingLines.length === 0) return;

                var notificationMap = {};
                trackingLines.forEach(function (line) {
                    var key = String(line.notificationId);
                    if (!notificationMap[key]) {
                        notificationMap[key] = [];
                    }
                    notificationMap[key].push(line);
                });

                log.debug('Mapeamento inicial de notificationId por linha', notificationMap);

                Object.keys(notificationMap).forEach(function (notificationId) {
                    try {
                        var carrierId = get_carrier_id_service.getCarrierIdFromMap(notificationMap, notificationId);
                        if (!carrierId) {
                            log.debug('Carrier ID ausente', { notificationId: notificationId });
                            return;
                        }

                        var carrierCode = carrier_service.getCarrierCode(carrierId);
                        if (!carrierCode) {
                            log.debug('Carrier code não encontrado', { carrierId: carrierId });
                            return;
                        }

                        notificationMap[notificationId][0].carrier = parseInt(carrierCode, 10);

                        log.debug('Carrier code substituído com sucesso', {
                            notificationId: notificationId,
                            carrierCode: carrierCode
                        });

                    } catch (e) {
                        log.error('Erro ao processar carrier para notificationId: ' + notificationId, e);
                    }
                });

                Object.keys(notificationMap).forEach(function (notificationId) {
                    var linha = notificationMap[notificationId][0];

                    if (!linha || !linha.trackingNumber || !linha.carrier) {
                        log.debug('Dados insuficientes para montar payload', { notificationId: notificationId });
                        return;
                    }

                    // ============================
                    // ETAPA 2.2
                    // Se o custom record estiver INATIVO, não processa
                    // ============================
                    var canProcess = notification_active_check_service
                        .canProcessNotification(notificationId);

                    if (!canProcess) {
                        log.audit('Tracking Notification inativo - processamento ignorado', {
                            notificationId: notificationId
                        });
                        return; // forEach → return
                    }

                    var payload = {
                        number: linha.trackingNumber,
                        carrier: linha.carrier
                    };

                    log.debug('Payload montado com sucesso', {
                        notificationId: notificationId,
                        payload: payload
                    });

                    try {
                        var trackingInfo = gettrackinfo_service.getTrackInfo(payload);

                        log.debug('Retorno da API 17Track', {
                            notificationId: notificationId,
                            trackingInfo: trackingInfo
                        });

                        var accepted = trackingInfo?.data?.accepted;
                        if (!accepted || !accepted.length || !accepted[0].track_info) {
                            log.debug('Sem dados aceitos na resposta da API', { notificationId: notificationId });
                            return;
                        }

                        var milestones = accepted[0].track_info.milestone || [];
                        var historicalData = historical_service.extractTrackHistorical(milestones);

                        // Construção do payload para atualização do custom record
                        var payloadUpdate = notification_payload_service.buildPayload({
                            status: accepted[0].track_info.latest_status?.status || '',
                            deliveryTo: accepted[0].track_info.time_metrics?.estimated_delivery_date?.to || null,
                            historicalData: historicalData
                        });

                        log.debug('Payload para atualização do registro customrecord_pd_tno_track_notification', {
                            notificationId: notificationId,
                            payloadUpdate: payloadUpdate
                        });

                        // Atualização do custom record (sem impactar afterSubmit)
                        var updateResult = track_notification_update_service
                            .updateSingleNotification(notificationId, payloadUpdate);

                        log.audit('customrecord_pd_tno_track_notification atualizado com sucesso', {
                            notificationId: notificationId,
                            result: updateResult
                        });

                    } catch (e) {
                        log.error('Erro ao consultar tracking ou atualizar registro', {
                            notificationId: notificationId,
                            error: e
                        });
                    }
                });

            } catch (error) {
                log.error('Erro no beforeLoad', error);
            }
        }



        function afterSubmit(context) {
            try {

                if (context.type !== context.UserEventType.CREATE &&
                    context.type !== context.UserEventType.EDIT) {
                    return;
                }

                const poId = context.newRecord.id;

                // ==========================================================
                // 1) REGISTRO NA 17TRACK (service novo)
                // ==========================================================

                const registerResult = register_tracking_number_service.registerTrackingNumbers(poId);
                const trackingData = registerResult && registerResult.trackingData;
                const responseRegister = registerResult && registerResult.responseRegister;

                log.debug('afterSubmit - trackingData', trackingData);

                if (!trackingData || !trackingData.items || trackingData.items.length === 0) {
                    log.debug('afterSubmit', 'Nenhuma linha com tracking para processar.');
                    return;
                }

                // ==========================================================
                // 2) ATUALIZAÇÃO DAS COLUNAS DA PO (via pd-tno-register-return.service.js)
                //    Monta payload e delega atualização para o service
                // ==========================================================

                const registerReturnPayload = {
                    idPurchaseOrder: poId,
                    items: []
                };

                if (responseRegister && responseRegister.code === 200 && responseRegister.body) {
                    let parsed = null;

                    try {
                        parsed = JSON.parse(responseRegister.body);
                    } catch (parseErr) {
                        log.error('afterSubmit - erro ao converter JSON de responseRegister', parseErr);
                    }

                    if (parsed && parsed.code === 0 && parsed.data && parsed.data.accepted) {

                        const acceptedArray = parsed.data.accepted || [];

                        acceptedArray.forEach(function (acceptedItem) {

                            const trackingNumber = acceptedItem.number;
                            const datetimeNow = new Date().toISOString();

                            const infoMessage = 'Tracking registered successfully\n' + datetimeNow;

                            const trackInfo = acceptedItem.track_info || {};
                            const timeMetrics = trackInfo.time_metrics;
                            const _edd = timeMetrics && timeMetrics.estimated_delivery_date;
                            const estimatedDeliveryTo = _edd ? (_edd.to || _edd.from || null) : null;

                            const matchingItems = (trackingData.items || []).filter(function (line) {
                                return line.trackingNumerLine === trackingNumber;
                            });

                            matchingItems.forEach(function (line) {
                                if (!line.lineReference) {
                                    return;
                                }

                                registerReturnPayload.items.push({
                                    lineReference: line.lineReference,
                                    datetime: datetimeNow,
                                    status: infoMessage,
                                    estimatedDelivery: estimatedDeliveryTo || null
                                });
                            });
                        });
                    }
                }

                log.debug('afterSubmit - registerReturnPayload', registerReturnPayload);

                if (registerReturnPayload.items.length > 0) {
                    try {
                        update_register_return_service.updatePORegisterReturn(registerReturnPayload);
                        log.audit('afterSubmit', 'Tracking register info updated successfully.');
                    } catch (err) {
                        log.error('afterSubmit - error calling updatePORegisterReturn', err);
                    }
                }

                // ==========================================================
                // 3) CRIAÇÃO DO customrecord_pd_tno_track_notification
                //    + AMARRAÇÃO NA PO (via pd-tno-track-notification.service.js)
                // ==========================================================

                try {
                    const poNotif = record.load({
                        type: record.Type.PURCHASE_ORDER,
                        id: poId,
                        isDynamic: false
                    });

                    const lineCount = poNotif.getLineCount({ sublistId: 'item' });
                    const createdMap = {}; // key = trackingNumberLine|carrierValue -> notificationId

                    for (let i = 0; i < lineCount; i++) {

                        const trackingNumberLine = poNotif.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_tno_track_nmb_order_line',
                            line: i
                        });

                        const carrierValue = poNotif.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_17track_tracking_carrier',
                            line: i
                        });

                        log.debug('linha 342 - afterSubmit - carrierValue', carrierValue);

                        // Dados mínimos obrigatórios
                        if (!trackingNumberLine || !carrierValue) {
                            continue;
                        }

                        // Se a linha já tem notificationId, não faz nada
                        const existingNotifIdOnLine = poNotif.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_tno_track_notification_id',
                            line: i
                        });

                        if (existingNotifIdOnLine) {
                            continue;
                        }

                        const key = trackingNumberLine + '|' + carrierValue;
                        let notificationId = createdMap[key] || null;

                        if (!notificationId) {

                            const _existingCheck = track_notification_query_service.existsNotification(trackingNumberLine);

                            if (_existingCheck.exists) {
                                notificationId = _existingCheck.notificationId;
                                createdMap[key] = notificationId;
                            } else {

                                const statusValue = poNotif.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pd_tno_tracking_status',
                                    line: i
                                }) || '';

                                const estimatedDateValue = poNotif.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pd_tno_estimated_delivery_dat',
                                    line: i
                                }) || null;

                                const statusDateObj = new Date();

                                const historicalObj = {
                                    trackingNumber: trackingNumberLine,
                                    carrier: carrierValue,
                                    status: statusValue,
                                    estimatedDelivery: estimatedDateValue,
                                    statusDate: statusDateObj
                                };

                                notificationId = track_notification_service.createTrackNotification({
                                    name: trackingNumberLine,
                                    trackingNumber: trackingNumberLine,
                                    carrier: carrierValue,
                                    status: statusValue,
                                    statusDate: statusDateObj,
                                    estimatedDeliveryDate: estimatedDateValue,
                                    historical: historicalObj,
                                    originTransaction: poId
                                });

                                if (!notificationId) {
                                    continue;
                                }

                                createdMap[key] = notificationId;
                            }
                        }

                        // Amarra o notificationId na linha atual da PO
                        poNotif.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_tno_track_notification_id',
                            line: i,
                            value: notificationId
                        });
                    }

                    if (Object.keys(createdMap).length > 0) {
                        poNotif.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });

                        log.audit('afterSubmit - Track Notification',
                            'Registros criados/atualizados | Total combinações: ' +
                            Object.keys(createdMap).length);
                    } else {
                        log.debug('afterSubmit - Track Notification',
                            'Nenhum registro created/updated para customrecord_pd_tno_track_notification.');
                    }

                } catch (eNotif) {
                    log.error('afterSubmit - erro ao criar/atualizar customrecord_pd_tno_track_notification', eNotif);
                }

            } catch (error) {
                log.error('afterSubmit - Erro inesperado', error);
            }
        }


        return {
            afterSubmit: afterSubmit,
            beforeLoad: beforeLoad
        };
    });

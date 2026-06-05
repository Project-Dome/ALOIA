/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author
 * Project Dome - Rogério Gonçalves Rodrigues
 *
 * Responsabilidade única:
 * - Montar o payload para /track/v2.4/register (17TRACK)
 * - Reaproveitar notificationId existente (quando houver)
 * - Chamar a API 17TRACK
 * - Retornar trackingData + responseRegister
 */

define([
    'N/https',
    'N/record',
    'N/log',

    './pd-tno-track-carriers.service',
    './pd-tno-get-tracking-data.service.js',
    './pd-tno-track-notification-query.service.js'
], function (
    https,
    record,
    log,

    carrier_service,
    gettrackdata_service,
    track_notification_query_service
) {

    const API_URL = 'https://api.17track.net/track/v2.4/register';


    const API_TOKEN = '06DFC2BE751424BCF3B7EE9481C64058';

    // ^Tracking number pela PO - Início
    function registerTrackingNumbers(poId) {
        try {

            if (!poId) {
                log.error('registerTrackingNumbers', 'Missing poId.');
                return {
                    trackingData: null,
                    responseRegister: null
                };
            }

            // 1) Buscar dados de tracking da PO
            const trackingData = gettrackdata_service.getTrackingData(poId);
            log.debug('registerTrackingNumbers - trackingData', trackingData);

            if (!trackingData || !trackingData.items || trackingData.items.length === 0) {
                log.debug('registerTrackingNumbers', 'Nenhuma linha com tracking para processar.');
                return {
                    trackingData: trackingData,
                    responseRegister: null
                };
            }

            // 2) Carrega a Purchase Order para ler/gravar notificationId por linha
            const poRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: false
            });

            const payloadRegister = [];

            // Mapas em memória
            const notificationMap = {}; // carrierCode|tracking -> notificationId já existente
            const comboMap = {};        // carrierCode|tracking -> já incluído no payload
            let poRecordChanged = false;

            (trackingData.items || []).forEach(function (item) {

                const lineReference = item.lineReference;
                const trackingNumber = item.trackingNumerLine;
                const carrierCode = carrier_service.getCarrierCode(item.carrier);
                const lineNumber = item.line ? parseInt(item.line, 10) : null;
                const lineIndex = (lineNumber && !isNaN(lineNumber)) ? (lineNumber - 1) : null;

                let notificationId = null;

                // Lê o notificationId atual da linha
                if (lineIndex !== null && lineIndex >= 0) {
                    try {
                        notificationId = poRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_tno_track_notification_id',
                            line: lineIndex
                        });
                    } catch (e) {
                        log.error('registerTrackingNumbers - erro ao ler custcol_pd_tno_track_notification_id', e);
                    }
                }

                const comboKey = (carrierCode || '') + '|' + (trackingNumber || '');

                // 1) Se já existe notificationId na linha, não processa mais nada
                if (notificationId) {
                    log.debug('registerTrackingNumbers - linha ignorada (já possui notificationId)', {
                        lineReference: lineReference,
                        trackingNumber: trackingNumber,
                        carrierCode: carrierCode,
                        notificationId: notificationId
                    });
                    notificationMap[comboKey] = notificationId;
                    return;
                }

                // 2) Valida dados mínimos da linha
                if (!trackingNumber || !lineReference || !carrierCode) {
                    log.debug('registerTrackingNumbers - linha ignorada (dados mínimos ausentes)', {
                        lineReference: lineReference,
                        trackingNumber: trackingNumber,
                        carrier: item.carrier,
                        carrierCode: carrierCode
                    });
                    return;
                }

                // 3) Verifica se já temos notificationId em memória para esse par carrier+tracking
                let existingNotificationId = notificationMap[comboKey] || null;

                // 4) Se ainda não temos em memória, consulta via SuiteQL
                if (!existingNotificationId) {
                    try {
                        const queryResult = track_notification_query_service.existsNotification(
                            carrierCode,
                            trackingNumber
                        );

                        if (queryResult && queryResult.exists && queryResult.notificationId) {
                            existingNotificationId = queryResult.notificationId;
                            notificationMap[comboKey] = existingNotificationId;
                        }
                    } catch (e) {
                        log.error('registerTrackingNumbers - erro ao consultar existsNotification', e);
                    }
                }

                // 5) Se já existe notification para este carrier + tracking, reaproveita e não registra de novo
                if (existingNotificationId) {
                    log.debug('registerTrackingNumbers - reaproveitando notification existente', {
                        lineReference: lineReference,
                        trackingNumber: trackingNumber,
                        carrierCode: carrierCode,
                        notificationId: existingNotificationId
                    });

                    if (lineIndex !== null && lineIndex >= 0) {
                        try {
                            poRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pd_tno_track_notification_id',
                                line: lineIndex,
                                value: existingNotificationId
                            });
                            poRecordChanged = true;
                        } catch (e) {
                            log.error('registerTrackingNumbers - erro ao setar custcol_pd_tno_track_notification_id', e);
                        }
                    }

                    // Não entra no payload de registro da 17Track
                    return;
                }

                // 6) Evita enviar mais de uma vez o mesmo par trackingNumber + carrier no MESMO payload
                if (comboMap[comboKey]) {
                    log.debug('registerTrackingNumbers - linha ignorada (tracking/carrier já processados neste payload)', {
                        lineReference: lineReference,
                        trackingNumber: trackingNumber,
                        carrierCode: carrierCode
                    });
                    return;
                }

                comboMap[comboKey] = true;

                payloadRegister.push({
                    number: trackingNumber,
                    carrier: carrierCode
                });
            });

            // Se atualizamos notificationId em alguma linha, salva a PO antes de seguir
            if (poRecordChanged) {
                try {
                    poRecord.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    log.audit('registerTrackingNumbers', 'PO atualizada com notificationId reaproveitado.');
                } catch (e) {
                    log.error('registerTrackingNumbers - erro ao salvar PO com notificationId', e);
                }
            }

            // Se não houve nenhum item válido para registrar na 17Track
            if (payloadRegister.length === 0) {
                log.debug('registerTrackingNumbers', 'Nenhum item válido para registro na 17Track.');
                return {
                    trackingData: trackingData,
                    responseRegister: null
                };
            }

            // 7) Chamada à API 17TRACK /register
            const payloadJSON = JSON.stringify(payloadRegister);

            const responseRegister = https.post({
                url: API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    '17token': API_TOKEN
                },
                body: payloadJSON
            });

            log.audit('registerTrackingNumbers - REGISTER response', {
                status: responseRegister.code,
                body: responseRegister.body
            });

            return {
                trackingData: trackingData,
                responseRegister: responseRegister
            };

        } catch (error) {

            log.error('registerTrackingNumbers - Erro inesperado', error);

            return {
                trackingData: null,
                responseRegister: null
            };
        }
    }
    // ^Tracking number pela PO - Início

    function registerInboundTrackingNumber(trackingNumber, carrierCode) {
        try {
            if (!trackingNumber || !carrierCode) {
                log.error('registerInboundTrackingNumber', {
                    message: 'Missing trackingNumber or carrierCode.',
                    trackingNumber: trackingNumber,
                    carrierCode: carrierCode
                });

                return {
                    success: false,
                    responseRegister: null,
                    parsedBody: null
                };
            }

            var payloadRegister = [
                {
                    number: trackingNumber,
                    carrier: carrierCode
                }
            ];

            log.audit('registerInboundTrackingNumber - payloadRegister', payloadRegister);

            var responseRegister = https.post({
                url: API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    '17token': API_TOKEN
                },
                body: JSON.stringify(payloadRegister)
            });

            log.audit('registerInboundTrackingNumber - REGISTER response', {
                status: responseRegister.code,
                body: responseRegister.body
            });

            var parsedBody = null;

            try {
                parsedBody = responseRegister && responseRegister.body
                    ? JSON.parse(responseRegister.body)
                    : null;
            } catch (parseError) {
                log.error('registerInboundTrackingNumber - erro parse JSON', {
                    error: parseError,
                    body: responseRegister ? responseRegister.body : null
                });
            }

            return {
                success: !!(parsedBody && parsedBody.code === 0),
                responseRegister: responseRegister,
                parsedBody: parsedBody
            };

        } catch (error) {
            log.error('registerInboundTrackingNumber - erro inesperado', error);

            return {
                success: false,
                responseRegister: null,
                parsedBody: null
            };
        }
    }


    return {
        registerTrackingNumbers: registerTrackingNumbers,
        registerInboundTrackingNumber: registerInboundTrackingNumber
    };

});

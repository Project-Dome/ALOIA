/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author
 * Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/record',
    'N/log'
], function (
    record,
    log
) {

    function parseDate(value) {
        if (!value) {
            return null;
        }

        if (Object.prototype.toString.call(value) === '[object Date]') {
            return value;
        }

        var str = String(value).trim();
        if (!str) {
            return null;
        }

        if (str.indexOf('T') > -1) {
            str = str.split('T')[0];
        }

        var parts = str.split('-');
        if (parts.length === 3) {
            return new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
            );
        }

        return null;
    }

    function normalizeHistorical(historical) {
        if (!historical) {
            return null;
        }

        // Já veio como array de strings (Etapa 2)
        if (Array.isArray(historical)) {
            return historical.join('\n\n');
        }

        // Já veio como string pronta
        if (typeof historical === 'string') {
            return historical;
        }

        // Fallback seguro
        try {
            return JSON.stringify(historical);
        } catch (e) {
            return String(historical);
        }
    }

    function createTrackNotification(data) {
        try {
            if (!data) {
                return null;
            }

            if (!data.trackingNumber || !data.carrier || !data.originTransaction) {
                return null;
            }

            var notificationRecord = record.create({
                type: 'customrecord_pd_tno_track_notification',
                isDynamic: false
            });

            // ============================
            // NAME (já tratado nas etapas anteriores)
            // ============================
            if (data.name) {
                notificationRecord.setValue({
                    fieldId: 'name',
                    value: data.name
                });
            }

            notificationRecord.setValue({
                fieldId: 'custrecord_pd_tno_tracking_number',
                value: data.trackingNumber
            });

            notificationRecord.setValue({
                fieldId: 'custrecord_pd_tno_carrier',
                value: data.carrier
            });

            if (data.status) {
                notificationRecord.setValue({
                    fieldId: 'custrecord_pd_tno_status',
                    value: data.status
                });
            }

            var statusDateObj = parseDate(data.statusDate) || new Date();
            notificationRecord.setValue({
                fieldId: 'custrecord_pd_tno_status_date',
                value: statusDateObj
            });

            if (data.estimatedDeliveryDate) {
                var estimatedDateObj = parseDate(data.estimatedDeliveryDate);
                if (estimatedDateObj) {
                    notificationRecord.setValue({
                        fieldId: 'custrecord_pd_tno_estimated_delivery_dat',
                        value: estimatedDateObj
                    });
                }
            }

            // ============================
            // HISTORICAL NORMALIZADO
            // ============================
            var historicalValue = normalizeHistorical(data.historical);
            if (historicalValue) {
                notificationRecord.setValue({
                    fieldId: 'custrecord_pd_tno_historical',
                    value: historicalValue
                });
            }

            notificationRecord.setValue({
                fieldId: 'custrecord_pd_tno_origin_transaction',
                value: data.originTransaction
            });

            var newId = notificationRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.debug('createTrackNotification - criado', newId);
            return newId;

        } catch (error) {
            log.error('createTrackNotification - erro', error);
            return null;
        }
    }

    return {
        createTrackNotification: createTrackNotification
    };

});

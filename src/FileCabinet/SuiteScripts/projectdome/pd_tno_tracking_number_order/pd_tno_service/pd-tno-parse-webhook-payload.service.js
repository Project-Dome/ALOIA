/**
 * @NApiVersion 2.x
 * @ModuleScope Public
 * @author: Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/log',
        './pd-tno-extract-track-historical.service',
        './pd-tno-extract-picked-up-date.service'
    ],
    function (
        log,
        extract_track_historical_service,
        extract_picked_up_date_service
    ) {

        function parseWebhookPayload(payload) {


           var logTitle = 'parseWebhookPayload';

            log.debug(logTitle, 'Raw Payload Received: ' + JSON.stringify(payload));

            var trackingNumber = payload.number || null;
            var carrier = payload.carrier || null;

            var trackInfo = payload.track_info || {};
            var latestEvent = trackInfo.latest_event || {};
            var latestStatus = trackInfo.latest_status || {};

            var _edd = trackInfo.time_metrics && trackInfo.time_metrics.estimated_delivery_date;
            var estimatedDelivery = _edd ? (_edd.to || _edd.from || null) : null;

            // 🔹 USAR SOMENTE milestone (padrão User Event)
            var milestones = Array.isArray(trackInfo.milestone)
                ? trackInfo.milestone
                : [];

            log.debug(logTitle, 'Milestones received: ' + milestones.length);

            // 🔹 Gera STRING no mesmo padrão do User Event
            var historicalText = extract_track_historical_service.extractTrackHistorical(milestones) || '';

            var pickedUpDate = extract_picked_up_date_service.getPickedUpDate(milestones);
            var serviceType = (trackInfo.misc_info && trackInfo.misc_info.service_type) || null;
            var providerServiceType = (trackInfo.tracking && trackInfo.tracking.providers && trackInfo.tracking.providers[0] && trackInfo.tracking.providers[0].service_type) || null;

            log.debug(logTitle, 'Historical generated (string): ' + historicalText);

            return {
                trackingNumber: trackingNumber,
                carrier: carrier,
                status: latestStatus.status || null,
                statusDate: latestEvent.time_utc || null,
                estimatedDeliveryDate: estimatedDelivery,
                historical: historicalText,
                serviceType: serviceType,
                providerServiceType: providerServiceType,
                pickedUpDate: pickedUpDate
            };
        }

        return {
            parseWebhookPayload: parseWebhookPayload
        };
    });
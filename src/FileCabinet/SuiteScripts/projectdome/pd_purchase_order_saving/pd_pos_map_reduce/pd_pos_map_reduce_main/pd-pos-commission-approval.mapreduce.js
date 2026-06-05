/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        '../pd_pos_map_reduce_service/pd-pos-commission-approval.mapreduce.service'
    ],
    function (
        map_reduce_service
    ) {
        return {
            getInputData: function (inputContext) {
                return map_reduce_service.getInputData(inputContext);
            },
            map: function (context) {
                map_reduce_service.map(context);
            },
            reduce: function (context) {
                map_reduce_service.reduce(context);
            }
        };
    }
);

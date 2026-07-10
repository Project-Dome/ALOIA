/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Rogério Gonçalves Rodrigues
 */

define([], function () {

    function getPickedUpDate(milestones) {

        if (!Array.isArray(milestones) || milestones.length === 0) {
            return null;
        }

        var pickedUpStage = null;

        milestones.forEach(function (stage) {
            if (pickedUpStage) return;
            if (!stage || stage.key_stage !== 'PickedUp' || !stage.time_iso) {
                return;
            }
            pickedUpStage = stage;
        });

        if (!pickedUpStage) {
            return null;
        }

        var pickedUpDate = new Date(pickedUpStage.time_iso);

        if (isNaN(pickedUpDate.getTime())) {
            return null;
        }

        return pickedUpDate;
    }

    return {
        getPickedUpDate: getPickedUpDate
    };
});

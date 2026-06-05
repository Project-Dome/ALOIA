/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/runtime'
    ],
    function (
        runtime
    ) {
        const FIELDS = {
            commissionPayment: { name: 'custscript_pd_pos_commission_payment' },
        };

        function commissionAccountPayment() {
            let _scriptObj = runtime.getCurrentScript();

            return _scriptObj.getParameter({ ...FIELDS.commissionPayment });
        }

        return {
            commissionAccountPayment: commissionAccountPayment
        }
    }
);
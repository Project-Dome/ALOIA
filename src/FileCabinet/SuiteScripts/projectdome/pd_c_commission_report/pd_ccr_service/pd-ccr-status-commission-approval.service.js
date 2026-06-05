/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [],
    function () {
        const TYPE = 'customlist_pd_ccr_status';

        const STATUS_COMMISSION = {
            APPROVED: 1,
            REPROVED: 2,
            PENDING: 3
        }

        return {
            STATUS_COMMISSION: STATUS_COMMISSION
        }
    }
)
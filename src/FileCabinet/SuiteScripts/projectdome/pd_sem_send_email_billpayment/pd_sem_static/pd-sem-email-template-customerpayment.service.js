/**
 * @NApiVersion 2.x
 * @NModuleScope public 
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */
define(
    [
        'N/log',
        'N/xml',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'

    ],
    function (
        log,
        xml
    ) {


        function templateXML(data) {

            return ['<?xml version="1.0"?>',
                '<p>Dear ${customer.companyName},</p>',
                '< p > We are pleased to inform you that we have received a payment according to the details below:</p >',
                '<table style="border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">',
                '<tr>',
                '<th style="padding: 6px; text-align: left;">Payment Number</th>',
                '<th style="padding: 6px; text-align: left;">Payment Date</th>',
                '<th style="padding: 6px; text-align: left;">Total Amount Received</th>',
                '</tr >',
                '<tr>',
                '<td style="padding: 6px;">' + ${ transaction.tranid } + '</td>',
                '<td style="padding: 6px;">' + ${ transaction.trandate } + '</td>',
                '<td style="padding: 6px;">USD' + ${transaction.amount } + '</td>',
                '</tr >',
                '</table >',
                '<p>The following invoices were included in this payment:</p>',

                '< !--Dynamic Invoices List-- >',
                '<table style="border-collapse: collapse; font-size: 14px; width: 100%;">',
                '<tr>',
                '<th style="padding: 6px; text-align: left;">Invoice Number</th>',
                '<th style="padding: 6px; text-align: left;">Invoice Date</th>',
                '<th style="padding: 6px; text-align: left;">Amount Applied</th>',
                '<th style="padding: 6px; text-align: left;">Balance Remaining</th>',
                '</tr >',

                '<#list appliedInvoices as invoice>',
                '<tr>',
                '< td style = "padding: 6px;" >' + ${ invoice.tranid } + '</td >',
                '<td style="padding: 6px;">' + ${ invoice.trandate } + '</td>',
                '<td style="padding: 6px;">USD ' + ${ invoice.amountApplied } + '</td>',
                '<td style="padding: 6px;">USD ' + ${ invoice.balanceRemaining } + '</td>',
                '</tr>',
                '</#list >',
                '</table >',

                '<p>If you have any questions or if any discrepancy is identified, please do not hesitate to contact us.</p>',

                '<p>We appreciate your partnership and prompt attention.</p>',

                '<p>Kind regards,<br>' +
                ${ preferences.user.name } + '<br>',
                'Accounts Receivable Department</p>'

            ].join(' ');

        }

        function buildItem(itemList) { }

        return {
            templateXML: templateXML
        }
    }
)
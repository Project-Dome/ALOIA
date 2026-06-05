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
                '<p>Dear ' + ${ vendor.companyName } + ${ transaction.tranid } ',</p>',
                '<p>We would like to inform you that a payment has been made with the following details:&nbsp; &nbsp; &nbsp;</p>',
                '<table style="border-collapse: collapse; font-size: 14px;">',
                '<tbody>',
                '< tr >',
                '<th style="padding: 6px; text-align: left;">Payment Number</th>',
                '<th style="padding: 6px; text-align: left;">Payment Date</th>',
                '<th style="padding: 6px; text-align: left;">Total Amount Paid</th>',
                '</tr >',
                '<tr>',
                '<td style="padding: 6px;">' + ${ transaction.tranid } + '</td>',
                '<td style="padding: 6px;">' + ${ transaction.trandate } + '</td>',
                '<td style="padding: 6px;">R$ ' + ${ transaction.amount } + '</td>',
                '</tr >',
                '</tbody >',
                '</table >',

                '<p>Vendor bills paid are listed bellow:&nbsp; &nbsp; &nbsp;</p>',
              
                '< !--Dynamic Bills List-- >',
                '<table style="border-collapse: collapse; font-size: 14px; width: 100%;">',
                '<tr>',
                '<th style="padding: 6px; text-align: left;">Bill Number</th>',
                '<th style="padding: 6px; text-align: left;">Bill Date</th>',
                '<th style="padding: 6px; text-align: left;">Amount Applied</th>',
                '<th style="padding: 6px; text-align: left;">Balance Remaining</th>',
                '</tr >',

                '<#list appliedBills as bill>',
                '<tr>',
                '< td style = "padding: 6px;" >' + ${ bill.tranid } + '</td >',
                '<td style="padding: 6px;">' + ${ bill.trandate } + '</td>',
                '<td style="padding: 6px;">USD ' + ${ bill.amountApplied } + '</td>',
                '<td style="padding: 6px;">USD ' + ${ bill.balanceRemaining } + '</td>',
                '</tr>',
                '</#list >',
                '</table >',
              
                '<p>Please review the details and contact us if you have any questions.</p>',
              
                '<p>Sincerely,<br />' + ${ preferences.user.name } + '<br />Finance Department</p>',

            ].join(' ');

        }

        function buildItem(itemList) { }

        return {
            templateXML: templateXML
        }
    }
)
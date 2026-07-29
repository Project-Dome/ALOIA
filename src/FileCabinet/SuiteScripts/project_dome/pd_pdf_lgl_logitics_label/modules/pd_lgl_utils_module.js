/**
 * @NApiVersion 2.1
 */
define([
        "N/query"
    ],

    (query) => {

        const handler = {}

        handler.getXmlParameters = (invoiceId) => {

            log.debug({
                title: "INVOICE ID",
                details: invoiceId
            });

            return query.runSuiteQL({
                query: (`SELECT pn, description, sn, is_serie, qty, manufacturer, po_number, rec_date,
                                exp_date, cond, uom, location, receiver, tagged_by, remark,
                                notes_customer, notes_po, notes_invoice
                         FROM (
                                  SELECT pn_number.NAME                                AS pn,
                                         invl.memo                                     AS description,
                                         invn.inventorynumber                          AS sn,
                                         CASE WHEN i.isserialitem = 'T' THEN 'T' ELSE 'F' END AS is_serie,
                                         ROUND(ABS(ia_inv.quantity) / NULLIF(line_uom.conversionrate, 0)) AS qty,
                                         mfg.companyname                               AS manufacturer,
                                         po.tranid                                     AS po_number,
                                         To_char(inv.trandate, 'MM/DD/YYYY')            AS rec_date,
                                         To_char(invn.expirationdate, 'MM/DD/YYYY')     AS exp_date,
                                         item_status.NAME                               AS cond,
                                         line_uom.unitname                              AS uom,
                                         loc.NAME                                       AS location,
                                         invn.custitemnumber_pd_wr_line                 AS receiver,
                                         inv.custbody_pd_lastcerifiedagency             AS tagged_by,
                                         inv.custbody_pd_remarks                        AS remark,
                                         customer.companyname                           AS notes_customer,
                                         so.otherrefnum                                 AS notes_po,
                                         inv.tranid                                      AS notes_invoice,
                                         invl.id                                         AS invoice_line_id,
                                         ia_inv.id                                       AS ia_id,
                                         inv.trandate                                    AS rec_date_raw,
                                         ROW_NUMBER() OVER (
               PARTITION BY invl.id, ia_inv.id
               ORDER BY inv.trandate DESC NULLS LAST
           ) AS rn
                                  FROM   TRANSACTION inv
                                             INNER JOIN transactionline invl
                                                        ON invl.TRANSACTION = inv.id
                                                            AND invl.mainline = 'F'
                                             INNER JOIN previoustransactionlinelink ptl_so
                                                        ON ptl_so.nextdoc = inv.id
                                                            AND ptl_so.nextline = invl.id
                                                            AND ptl_so.linktype = 'OrdBill'
                                             INNER JOIN TRANSACTION so
                                                        ON so.id = ptl_so.previousdoc
                                                            AND so.type = 'SalesOrd'
                                             INNER JOIN inventoryassignment ia_inv
                                                        ON ia_inv.TRANSACTION = invl.TRANSACTION
                                                            AND ia_inv.transactionline = invl.id
                                             LEFT JOIN previoustransactionlinelink ptl_so_po
                                                       ON ptl_so_po.previousdoc = ptl_so.previousdoc
                                                           AND ptl_so_po.previousline = ptl_so.previousline
                                                           AND ptl_so_po.linktype = 'SpecOrd'
                                             LEFT JOIN TRANSACTION po
                                                       ON po.id = ptl_so_po.nextdoc
                                                           AND po.type = 'PurchOrd'
                                             LEFT JOIN item i
                                                       ON i.id = invl.item
                                             LEFT JOIN inventorynumber invn
                                                       ON invn.id = ia_inv.inventorynumber
                                             LEFT JOIN unitstypeuom line_uom
                                                       ON line_uom.internalid = invl.units
                                             LEFT JOIN customrecord_aae_part_number_spec_vend pn_number
                                                       ON pn_number.id = invl.custcol_pd_partnumbervendor
                                             LEFT JOIN customlist_pd_aae_status_item item_status
                                                       ON item_status.id = invl.custcol_pd_aae_status_item
                                             LEFT JOIN location loc
                                                       ON loc.id = invl.location
                                             LEFT JOIN customer
                                                       ON customer.id = so.entity
                                             LEFT JOIN vendor mfg
                                                       ON mfg.id = invl.custcol_aae_manufacturer
                                  WHERE  inv.id = ?
                              ) sub
                         WHERE sub.rn = 1
                         ORDER BY sub.rec_date_raw DESC NULLS LAST, sub.invoice_line_id, sub.ia_id`),
                params: [invoiceId]
            }).asMappedResults();

        }

        return handler;

    });

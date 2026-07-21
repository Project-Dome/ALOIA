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
                                         po.tranid                                      AS po_number,
                                         To_char(t.trandate, 'MM/DD/YYYY')              AS rec_date,
                                         To_char(invn.expirationdate, 'MM/DD/YYYY')     AS exp_date,
                                         item_status.NAME                               AS cond,
                                         line_uom.unitname                              AS uom,
                                         loc.NAME                                       AS location,
                                         t.custbody_wr                                  AS receiver,
                                         inv.custbody_pd_lastcerifiedagency             AS tagged_by,
                                         inv.custbody_pd_remarks                        AS remark,
                                         customer.companyname                           AS notes_customer,
                                         so.otherrefnum                                 AS notes_po,
                                         inv.tranid                                     AS notes_invoice,
                                         invl.id                                         AS invoice_line_id,
                                         ia_inv.id                                       AS ia_id,
                                         t.trandate                                      AS rec_date_raw,
                                         ROW_NUMBER() OVER (
               PARTITION BY invl.id, ia_inv.id
               ORDER BY t.trandate DESC NULLS LAST
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
                                             LEFT JOIN transactionline pol
                                                       ON pol.id = ptl_so_po.nextline
                                                           AND pol.TRANSACTION = po.id
                                                           AND pol.mainline = 'F'
                                             LEFT JOIN previoustransactionlinelink ptl_po_rcpt
                                                       ON ptl_po_rcpt.previousdoc = po.id
                                                           AND ptl_po_rcpt.previousline = pol.id
                                                           AND ptl_po_rcpt.linktype = 'ShipRcpt'
                                             LEFT JOIN TRANSACTION t
                                                       ON t.id = ptl_po_rcpt.nextdoc
                                                           AND t.type = 'ItemRcpt'
                                             LEFT JOIN transactionline tl
                                                       ON tl.id = ptl_po_rcpt.nextline
                                                           AND tl.TRANSACTION = t.id
                                                           AND tl.mainline = 'F'
                                             LEFT JOIN item i
                                                       ON i.id = invl.item
                                             LEFT JOIN inventorynumber invn
                                                       ON invn.id = ia_inv.inventorynumber
                                             LEFT JOIN unitstypeuom line_uom
                                                       ON line_uom.internalid = invl.units
                                             LEFT JOIN customrecord_aae_part_number_spec_vend pn_number
                                                       ON pn_number.id = pol.custcol_pd_partnumbervendor
                                             LEFT JOIN customlist_pd_aae_status_item item_status
                                                       ON item_status.id = tl.custcol_pd_aae_status_item
                                             LEFT JOIN location loc
                                                       ON loc.id = tl.location
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

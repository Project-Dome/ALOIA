const RESTLET = {
    script: 'customscript_pd_ccr_search_comission',
    deployment: 'customdeploy_pd_ccr_search_comission_rt'
}

const APPROVE = {
    script: 'customscript_pd_ccr_approve_comission',
    deployment: 'customdeploy_pd_ccr_approve_comission_rt'
}

$(document).ready(function () {
    loadCommissionReport();
})

function loadCommissionReport() {
    let _modal = loading('Please wait for the page to reload...');

    get({
        restlet: RESTLET,
        onSuccess: function (response) {
            loadPartnerTable(response);
        },
        onComplete: function () {

            _modal.modal('hide');
        },
        onError: function (errorMessage) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Atenção!',
                message: errorMessage
            });
        }
    })
}

function loadPartnerTable(data) {
    const $tableBody = $('#commission-approval-table tbody');
    const $tableTHead = $('#commission-approval-table thead');

    $tableTHead.empty();
    $tableBody.empty();

    if (!data || Object.keys(data).length === 0) {
        $tableBody.append('<tr><td colspan="7" style="text-align: center;">No results loaded.</td></tr>');
        return;
    }

    createThForInvoice($tableTHead);

    Object.keys(data).forEach(tranId => {
        const invoiceData = data[tranId];

        createInvoice($tableBody, invoiceData);

        createTable($tableBody, invoiceData);

        invoiceData.items.forEach(transactionLineData => {
            createTransactionLines($(`.${invoiceData.invoiceId} table tbody`), transactionLineData);
        })
    });
}

function createTransactionLines(tableBody, data) {
    tableBody.append(
        `<tr class="${data.transactionId}" hidden>
            <td>${data.soTranId ? `<a target="_blank" href="${data.soUrl}">${data.soTranId}</a>` : '-'}</td>
            <td>${data?.item?.name ? data.item.name : '-'}</td>
            <td>${data?.urgency?.name ? data.urgency.name : '-'}</td>
            <td>${data?.buyer?.name ? data.buyer.name : '-'}</td>
            <td>${data?.custPOReceipt ? data.custPOReceipt : '-'}</td>
            <td>${data?.salesRep?.name ? data.salesRep.name : '-'}</td>
            <td>${data?.deliveryDate ? data.deliveryDate : '-'}</td>
            <td>${data?.salesDescription ? data.salesDescription : '-'}</td>
            <td>${data?.quantity ? data.quantity : '-'}</td>
            <td>${data?.rate ? formatCurrency(data.rate) : '-'}</td>
            <td>${data?.supplierVendor?.name ? data.supplierVendor.name : '-'}</td>
            <td>${data?.stockAloia ? data.stockAloia : '-'}</td>
            <td>${data?.tranDate ? data.tranDate : '-'}</td>
            <td>${data?.shippingCost ? formatCurrency(data.shippingCost) : '-'}</td>
            <td>${data?.handlingCost ? formatCurrency(data.handlingCost) : '-'}</td>
            <td>${data?.totalCostUSD ? formatCurrency(data.totalCostUSD) : '-'}</td>
            <td>${data?.costEAUSD ? formatCurrency(data.costEAUSD) : '-'}</td>
            <td>${data?.amount ? formatCurrency(data.amount) : '-'}</td>
            <td>${data?.operationalProfitUSD ? formatCurrency(data.operationalProfitUSD) : '-'}</td>
            <td>${data?.percent ? data.percent : '-'}</td>
            <td>${data?.salesCommission ? data.salesCommission : '-'}</td>
            <td>${data?.customerCommissionPercent ? data.customerCommissionPercent : '-'}</td>
            <td>${data?.usdCommission ? formatCurrency(data.usdCommission) : parseFloat(0)}</td>
        </tr>`
    );
}

function formatCurrency(value) {
    return parseFloat(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
    }).replace('$', '')
}

function createThForInvoice(tableHead) {
    return tableHead.append(
        `<tr>
            <td> </td> 
            <td style="white-space: nowrap; border-bottom: 2px solid #000; font-size: 20px">Select</td>
            <td style="white-space: nowrap; border-bottom: 2px solid #000; font-size: 20px">Invoice</td>
            <td style="white-space: nowrap; border-bottom: 2px solid #000; font-size: 20px">Customer</td>
            <td style="white-space: nowrap; border-bottom: 2px solid #000; font-size: 20px">Commission Total</td>
        </tr>`
    );
}

function createInvoice(tableBody, data) {
    return tableBody.append(
        `<tr class="text-center">
            <td> 
                <input type="checkbox" data-target="${data.commissionId}">
            </td>
            <td>
                <button class="btn btn-light btn-sm checked" onclick="toggleIcon(this, '${data.invoiceId}')"  data-toggle="collapse" role="button" aria-expanded="false"> 
                    <i class="fa fa-sort" style="font-size:13px"></i>
                </button>
            </td>
            <td>${data.items[0].tranID ? `<a target="_blank" href="${data.items[0].invoiceUrl}">${data.items[0].tranID}</a>` : '-'}</td>
            <td>${data.items[0].customer ? data.items[0].customer.name : '-'}</td>
            <td>${data.commissionTotal || data.commissionTotal == 0 ? formatCurrency(data.commissionTotal) : '-'}</td>
        </tr>`
    )
}

function createTable(tableBody, data) {
    tableBody.append(
        `<tr class="${data.invoiceId}" hidden>
            <td colspan="12">
                <table class="table table-success table-striped" style="width: 98%; margin: 0 auto; font-size: 1rem">
                    <thead class="thead-dark">
                        <tr>
                            <th scope="col">So Transaction</th>
                            <th scope="col">Item</th>
                            <th scope="col">Urgency</th>
                            <th scope="col">Buyer</th>
                            <th scope="col">Cust PO Receipt</th>
                            <th scope="col">Sales Rep</th>
                            <th scope="col">Delivery Date</th>
                            <th scope="col">Sales Description</th>
                            <th scope="col">Quantity</th>
                            <th scope="col">Rate</th>
                            <th scope="col">Supplier Vendor</th>
                            <th scope="col">Stock Aloia</th>
                            <th scope="col">Date</th>
                            <th scope="col">Shipping Cost</th>
                            <th scope="col">Handling Cost</th>
                            <th scope="col">Total Cost USD</th>
                            <th scope="col">Cost EA USD</th>
                            <th scope="col">Amount</th>
                            <th scope="col">Operational Profit USD</th>
                            <th scope="col">Percent</th>
                            <th scope="col">Sales Commission</th>
                            <th scope="col">Customer Commission Percent</th>
                            <th scope="col">USD Commission</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </td>
        </tr>`
    )
}

function toggleIcon(iconElement, targetId) {
    const isRotated = iconElement.classList.contains('checked');

    if (isRotated) {
        iconElement.classList.remove('checked');

        let childRows = $(`.${targetId}`);
        childRows.removeAttr('hidden');

        childRows.each(function () {
            $(this).removeAttr('hidden');
        })

    } else {
        console.log('Recolhendo - adicionando classe rotated');
        iconElement.classList.add('checked');

        let childRows = $(`.${targetId}`);
        childRows.attr('hidden', '');

        childRows.each(function () {
            $(this).attr('hidden', '');
        })
    }
}

function getSelectedRTs() {
    const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"][data-target]:checked');
    const dataTargets = Array.from(selectedCheckboxes).map(checkbox => checkbox.getAttribute('data-target'));

    console.log('Data-targets selecionados:', dataTargets);
    return dataTargets;
}

function approve() {
    const selected = getSelectedRTs();
    if (!selected.length) {
        alert('Selecione pelo menos um registro para aprolet.');
        return;
    }

    post({
        restlet: APPROVE,
        data: {
            isApprov: true,
            records: selected
        },
        onSuccess: function () {
            window.location.reload();
        }
    })
}

function reprov() {
    const selected = getSelectedRTs();
    if (!selected.length) {
        alert('Selecione pelo menos um registro para reprolet.');
        return;
    }

    post({
        restlet: APPROVE,
        data: {
            isApprov: false,
            records: selected
        },
        onSuccess: function () {
            window.location.reload();
        }
    })
}
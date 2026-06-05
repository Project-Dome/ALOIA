const RESTLET_ID_APPROVE_COMMISSION = {
    script: 'customscript_pd_pos_comm_approval_po_rt',
    deployment: 'customdeploy_pd_pos_comm_approval_po_rt'
}

$(document).ready(function () {
    loadCommissionReport();
})

function loadCommissionReport() {
    let _modal = loading('Wait for the page to load...');

    get({
        restlet: RESTLET_ID_APPROVE_COMMISSION,
        onSuccess: function (response) {
            console.log('response: ', response);

            loadCommissionApproval(response);
        },
        onComplete: function () {

            _modal.modal('hide');
        },
        onError: function (errorMessage) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Attention!',
                message: errorMessage
            });
        }
    })
}

function loadCommissionApproval(data) {

    const $tableBody = $('#commission-approval-table tbody');
    const $tableTHead = $('#commission-approval-table thead');

    $tableTHead.empty();
    $tableBody.empty();

    if (!data.vendorBillLinesMap || Object.keys(data?.vendorBillLinesMap).length === 0) {
        $tableBody.append('<tr><td colspan="7" style="text-align: center;">Nenhum registro encontrado</td></tr>');
        return;
    }

    createThForVendorBill($tableTHead);

    Object.keys(data.vendorBillLinesMap).forEach(transactionId => {
        const items = data.vendorBillLinesMap[transactionId];
        const vendorBillSavingTotal = data?.vendorBillSavingTotal[transactionId]?.totalSaving;

        createVendorBill($tableBody, items[0], vendorBillSavingTotal);

        createTable($tableBody, items[0]);

        items.forEach(transactionLineData => {
            createTransactionLines($(`.${items[0].id}-${items[0].buyer} table tbody`), transactionLineData);
        })
    });
}

function createThForVendorBill(tableHead) {
    return tableHead.append(
        `<tr class="text-center">
        <th class="text-center"><i class="fa fa-check"></i></th>
        <th class="text-center">#</i></th>
            <th>Nº da Invoice</th>
            <th>Vendor</th>
            <th>Saving Total</th>
        </tr>`
    );
}

function createVendorBill(tableBody, data, vendorBillSavingTotal) {
    return tableBody.append(
        `<tr class="text-center">
            <td class="text-center"> 
                <input type="checkbox" data-target="${data.commissionRecordId}">
            </td>
            <td class="text-center" id="${data.id}"> <i class="fas fa-chevron-down text-primary rotated" onclick="toggleIcon(this, '${data.id}-${data.buyer}')"></i> </td>
            <td>${data.tranId ? `<a target="_blank" href="${data.transactionVendorBillUrl}">${data.tranId}</a>` : '-'}</td>
            <td>${data.entity ? data.entity.name : '-'}</td>
            <td>${vendorBillSavingTotal ? formatCurrency(vendorBillSavingTotal) : '-'}</td>
        </tr>`
    )
}

function toggleIcon(iconElement, targetId) {
    const isRotated = iconElement.classList.contains('rotated');

    console.log('Estado atual da classe rotated:', isRotated);

    if (isRotated) {
        console.log('Expandindo - removendo classe rotated');
        iconElement.classList.remove('rotated');

        let childRows = $(`.${targetId}`);
        childRows.removeAttr('hidden');

        childRows.each(function () {
            $(this).removeAttr('hidden');
        })

    } else {
        console.log('Recolhendo - adicionando classe rotated');
        iconElement.classList.add('rotated');

        let childRows = $(`.${targetId}`);
        childRows.attr('hidden', '');

        childRows.each(function () {
            $(this).attr('hidden', '');
        })

    }
}

function createTable(tableBody, data) {
    tableBody.append(
        `<tr class="${data.id}-${data.buyer}" hidden>
            <td colspan="12">
                <table class="table table-success table-striped" style="width: 98%; margin: 0 auto; font-size: 1rem">
                    <thead class="thead-dark">
                        <tr>
                            <th scope="col">Item</th>
                            <th scope="col">Part Number</th>
                            <th scope="col">Quantity</th>
                            <th scope="col">Estimated Cost</th>
                            <th scope="col">Rate</th>
                            <th scope="col">Saving Per Unit</th>
                            <th scope="col">Saving Total For Line</th>
                            <th scope="col">PO Information</th>
                            <th scope="col">Commission Saving For Line</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </td>
        </tr>`
    )
}

function createTransactionLines(tableBody, data) {
    tableBody.append(
        `<tr class="${data.id}-${data.buyer}" hidden>
            <td>${data.item.name ? data.item.name : '-'}</td>
            <td>${data.partNumberName ? data.partNumberName : '-'}</td>
            <td>${data.quantity ? formatCurrency(data.quantity * -1) : '-'}</td>
            <td>${data.estimatedCost ? formatCurrency(data.estimatedCost) : '-'}</td>
            <td>${data.rate ? formatCurrency(data.rate) : '-'}</td>
            <td>${data.perUnit ? formatCurrency(data.perUnit) : '-'}</td>
            <td>${data.total ? formatCurrency(data.total) : '-'}</td>
            <td>${data.appliedToTransaction ? `<a target="_blank" href="${data.transactionLineUrl}">${data.appliedToTranId}</a>` : '-'}</td>
            <td>${data.amount ? formatCurrency(data.amount) : '-'}</td>
        </tr>`
    );
}

function formatCurrency(value) {
    return parseFloat(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).replace('R$', '')
}

function approve() {
    const selected = getSelectedDataTargets();

    if (!selected.length) {
        $.modal({
            type: 'alert',
            title: 'Attention!',
            message: 'Selecione pelo menos um registro para aprovar.'
        });

        return;
    }

    post({
        restlet: RESTLET_ID_APPROVE_COMMISSION,
        data: {
            isApprove: true,
            records: selected
        },
        onSuccess: function () {
            window.location.reload();
        },
        onError: function (errorMessage) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Attention!',
                message: errorMessage
            });
        }
    })
}

function getSelectedDataTargets() {
    const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"][data-target]:checked');
    const dataTargets = Array.from(selectedCheckboxes).map(checkbox => checkbox.getAttribute('data-target'));

    console.log('Data-targets selecionados:', dataTargets);
    return dataTargets;
}

function reprov() {
    const selected = getSelectedDataTargets();

    if (!selected.length) {
        $.modal({
            type: 'alert',
            title: 'Attention!',
            message: 'Selecione pelo menos um registro para reprovar.'
        });

        return;
    }

    post({
        restlet: RESTLET_ID_APPROVE_COMMISSION,
        data: {
            isApprove: false,
            records: selected
        },
        onSuccess: function () {
            window.location.reload();
        },
        onError: function (errorMessage) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Attention!',
                message: errorMessage
            });
        }
    })
}
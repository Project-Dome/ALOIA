const COMMISSION_PAYMENT_RESTLET = {
    script: 'customscript_pd_pos_commission_paym_rt',
    deployment: 'customdeploy_pd_pos_commission_paym_rt'
};

$(document).ready(function () {
    loadCommissionData();
});

function loadCommissionData() {
    let _modal = loading('Wait for the page to load...');

    get({
        restlet: COMMISSION_PAYMENT_RESTLET,
        onSuccess: function (response) {
            loadOptionsCommission(response)
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
    });
}

function loadOptionsCommission(data) {
    const $tableBody = $('#commission-payment-table tbody');
    const $tableTHead = $('#commission-payment-table thead');

    $tableTHead.empty();
    $tableBody.empty();

    if (!data || Object.keys(data).length === 0) {
        $tableBody.append('<tr><td colspan="7" style="text-align: center;">No records found</td></tr>');
        return;
    }

    createThForCommission($tableTHead);

    Object.keys(data).forEach(vendorId => {
        const commissionList = data[vendorId];

        createVendor($tableBody, commissionList);

        createTable($tableBody, commissionList.vendorEmployee);

        commissionList.items.forEach(transactionLineData => {
            createTransactionLines($(`.${commissionList.vendorEmployee.id} table tbody`), transactionLineData);
        })
    });
}

function createThForCommission(tableTHead) {
    return tableTHead.append(
        `<tr class="text-center">
            <th class="text-center"><i class="fa fa-check"></i></th>
            <th class="text-center">#</i></th>
            <th>Vendor</th>
            <th>Total Commission</th>
        </tr>`
    );
}

function createVendor(tableBody, commissionData) {
    return tableBody.append(
        `<tr class="text-center">
            <td class="text-center"> 
                <input type="checkbox" id="create-vendor-${commissionData.vendorEmployee.id}">
                <div class="hidden" id="commission-data">${JSON.stringify(commissionData)}</div>
            </td>
            <td class="text-center" id="${commissionData.vendorEmployee.id}"> <i class="fas fa-chevron-down text-primary rotated" onclick="toggleIcon(this, '${commissionData.vendorEmployee.id}')"></i> </td>
            <td>${commissionData.vendorEmployee.name ? commissionData.vendorEmployee.name : '-'}</td>
            <td>${commissionData.totalCommission ? formatCurrency(commissionData.totalCommission) : '-'}</td>
        </tr>`
    )
}

function toggleIcon(iconElement, targetId) {
    const isRotated = iconElement.classList.contains('rotated');

    if (isRotated) {
        iconElement.classList.remove('rotated');

        let childRows = $(`.${targetId}`);

        childRows.each(function () {
            $(this).removeAttr('hidden');
        })

    } else {
        iconElement.classList.add('rotated');

        let childRows = $(`.${targetId}`);

        childRows.each(function () {
            $(this).attr('hidden', '');
        })
    }
}

function createTable(tableBody, vendor) {
    tableBody.append(
        `<tr class="${vendor.id}" hidden>
            <td colspan="12">
                <table class="table table-success table-striped" style="width: 98%; margin: 0 auto; font-size: 1rem">
                    <thead class="thead-dark">
                        <tr>
                            <th scope="col">Transaction</th>
                            <th scope="col">Commission Amount</th>
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
        `<tr class="${data.vendorEmployee.id}" hidden>
            <td>${data.tranId ? `<a target="_blank" href="${data.transactionUrl}">${data.tranId}</a>` : '-'}</td>
            <td>${data.amountValue ? formatCurrency(data.amountValue) : '-'}</td>
        </tr>`
    );
}

function formatCurrency(value) {
    return parseFloat(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).replace('R$', '')
}


function getSelectedCheckboxesWithData() {
    const selectedData = [];

    const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="create-vendor-"]:checked');

    selectedCheckboxes.forEach(function (checkbox) {
        const dataDiv = checkbox.parentElement.querySelector('#commission-data');

        if (dataDiv) {
            try {
                const commissionData = JSON.parse(dataDiv.textContent);

                selectedData.push({
                    checkboxId: checkbox.id,
                    vendorId: commissionData.vendorEmployee.id,
                    data: commissionData,
                    dueDate: $('#due-date').val()
                });
            } catch (error) {
                console.error('Erro ao fazer parse do JSON:', error);
            }
        }
    });

    console.log('Dados selecionados:', selectedData);

    return selectedData;
}

function createCommissionTransaction() {
    const selectedIndexes = getSelectedCheckboxesWithData();
    console.log('selectedIndexes', selectedIndexes);

    const dueDate = $('#due-date').val();

    if (!selectedIndexes.length) {
        $.modal({
            type: 'alert',
            title: 'Attention!',
            message: 'Select at least one record to create the Vendor Bill.'
        });

        return;
    }

    if (!dueDate) {
        $.modal({
            type: 'alert',
            title: 'Attention!',
            message: 'Please provide the Vendor Bill Due Date.'
        });

        return;
    }

    let _modal = loading('creating commission transaction...');

    post({
        restlet: COMMISSION_PAYMENT_RESTLET,
        data: selectedIndexes,
        onSuccess: function () {
            _modal.modal('hide');
            window.location.reload();
        },
        onComplete: function () {

            setTimeout(function () {
                window.location.reload();
            }, 10000);
        },
        onError: function (errorMessage) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Attention!',
                message: errorMessage
            });
        }
    });
}
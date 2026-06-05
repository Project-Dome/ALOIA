const RESTLET = {
    script: 'customscript_pd_ccr_comission_paymt_rt',   // ID real do Restlet
    deployment: 'customdeploy_pd_ccr_comission_paymt_rt'
};

VENDOR_BILL = {
    script: 'customscript_pd_ccr_create_vendor_bill',   // ID real do Restlet
    deployment: 'customdeploy_pd_ccr_create_vendor_billrt'
};

$(document).ready(function () {
    loadCommissionData();
});

function loadCommissionData() {
    let _modal = loading('Wait for the page to load...');

    post({
        restlet: RESTLET,
        onSuccess: function (response) {
            _modal.modal('hide');
            if (response.success && response.data && response.data.length) {
                renderCommissionTable(response.data);
            } else {
                renderNoResults();
                console.warn('No data returned by Restlet', response);
            }
        },
        onError: function (err) {
            _modal.modal('hide');
            console.error('Error calling Restlet', err);
            renderNoResults();
        }
    });
}

function renderCommissionTable(data) {
    window.commissionData = data; // salva globalmente
    var _listBody = $('#commission-table');

    var vendorGroups = {};
    data.forEach((item, originalIndex) => {
        var vendorKey = item.vendorEmployee || 'no-vendor';

        if (!vendorGroups[vendorKey]) {
            vendorGroups[vendorKey] = {
                total: null,
                items: []
            };
        }

        let newItem = { ...item, originalIndex: originalIndex };

        if (item.isTotal || vendorGroups[vendorKey].total === null) {
            vendorGroups[vendorKey].total = newItem;
        } else {
            vendorGroups[vendorKey].items.push(newItem);
        }
    });

    var vendorKeys = Object.keys(vendorGroups);

    var html = `
        <table class="table table-striped table-bordered align-middle">
            <thead class="table-dark text-center">
                <tr>
                    <td></td>
                    <td>Select</td>
                    <td>Vendor Employee</td>
                    <td>Total Commission</td>
                </tr>
            </thead>
            <tbody>
    `;

    vendorKeys.forEach((vendorKey, vendorIndex) => {
        var vendorGroup = vendorGroups[vendorKey];
        var vendorTotal = vendorGroup.total;
        var vendorItems = vendorGroup.items;

        html += `
            <tr>
                <td>
                    ${vendorItems.length > 0 ?
                `<button class="btn btn-light btn-sm" href="#vendor-container${vendorIndex}" 
                            data-toggle="collapse" role="button" aria-expanded="false" 
                            aria-controls="vendor-container${vendorIndex}"> 
                            <i class="fa fa-sort" style="font-size:13px"></i>
                        </button>`
                : ''
            }
                </td>
                <td class="text-center">
                    <input type="checkbox" class="approve-check group-check" 
                        data-vendor-index="${vendorIndex}" 
                        value="${vendorTotal?.originalIndex ?? ''}" />
                </td>
                <td>${vendorKey}</td>
                <td>${Number(ifNullOrEmpty(vendorTotal?.amountValue, 0)).format()}</td>
            </tr>
        `;

        html += `
                <tr class="collapse" id="vendor-container${vendorIndex}">
                    <td colspan="12">
                        <table class="table table-success table-striped" style="width: 98%; margin: 0 auto; font-size: 1rem">
                        <thead class="thead-dark">
                            <tr>
                                <th>Vendor Employee</th>
                                <th>Invoice</th>
                                <th>Total Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${loadLines(vendorItems)}
                        </tbody>
                        </table>
                    </td>
                </tr>
            `;
    });

    html += '</tbody></table>';
    _listBody.html(html);
}

function loadLines(vendorItems) {
    let lines = '';

    vendorItems.forEach((item, itemIndex) => {

        lines += `<tr>
                    <td>${item.vendorEmployee}</td>
                    <td>${item.invoiceUrl ? `<a target="_blank" href="${item.invoiceUrl}">${item.invoiceName}</a>` : '-'}</td>
                    <td>${Number(ifNullOrEmpty(item.amountValue, 0)).format()}</td>
                </tr>`
    });

    return lines
}


function getSelectedRTs() {
    let selected = [];
    $('.approve-check:checked').each(function () {
        selected.push(parseInt($(this).val()));
    });
    return selected;
}

function createCommissionInvoice() {
    const selectedIndexes = getSelectedRTs();
    const dueDate = $('#due-date').val();

    if (!selectedIndexes.length) {
        alert('Select at least one record to create the Vendor Bill.');
        return;
    }
    if (!dueDate) {
        alert('Please provide the Vendor Bill Due Date.');
        return;
    }

    const selectedRecords = selectedIndexes.map(i => window.commissionData[i]);

    const vendorId = selectedRecords[0].vendorEmployeeId;

    console.log('Selected Records:', selectedRecords);
    console.log('Expiration Due Date:', dueDate);
    console.log('Vendor ID:', vendorId);

    let _modal = loading('creating commission transaction...');

    post({
        restlet: VENDOR_BILL,
        data: {
            records: selectedRecords,
            dueDate: dueDate,
            vendorId: vendorId
        },
        onSuccess: function (response) {
            _modal.modal('hide');
            if (response.success) {
                loadCommissionData();
                location.reload();
            } else {
                $.modal({
                    type: 'alert',
                    title: 'Attention!',
                    message: response.message
                });
            }
        },
        onError: function (err) {
            _modal.modal('hide');

            $.modal({
                type: 'alert',
                title: 'Attention!',
                message: err
            });
        }
    });
}

function ifNullOrEmpty(value, defaultValue) {
    return (value === null || value === undefined || value === '') ? defaultValue : value;
}
// Guardamos os dados em variável global para acessar os selecionados
// function renderCommissionTable(data) {
//     window.commissionData = data; // salva globalmente
//     var _listBody = $('#commission-table');

//     var html = `
//         <table class="table table-striped table-bordered align-middle">
//             <thead class="table-dark text-center">
//                 <tr>
//                     <td>Select</td>
//                     <td>Vendor Employee</td>
//                     <td>Total Commission Value</td>
//                 </tr>
//             </thead>
//             <tbody>
//     `;

//     data.forEach(function (item, index) {
//         html += `
//             <tr>
//                 <td class="text-center">
//                     <input type="checkbox" class="approve-check" value="${index}" />
//                 </td>
//                 <td>${item.vendorEmployee}</td>
//                 <td>${item.amountValue.toFixed(2)}</td>
//             </tr>
//         `;
//     });

//     html += '</tbody></table>';
//     _listBody.html(html);
// }
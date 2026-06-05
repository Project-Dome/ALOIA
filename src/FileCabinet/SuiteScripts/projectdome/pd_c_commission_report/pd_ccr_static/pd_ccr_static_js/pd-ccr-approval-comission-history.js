const RESTLET = {
    script: 'customscript_pd_ccr_comission_history_rt',
    deployment: 'customdeploy_pd_ccr_comission_history_rt'
};

$(document).ready(function () {
    loadData({}); // inicial com objeto vazio

    $('#apply-filters').on('click', function () {
        const filters = {
            customer: $('#filter-customer').val(),
            vendor: $('#filter-vendor').val(),
            buyer: $('#filter-buyer').val(),
            sales: $('#filter-sales').val(),
            invoiceDateFrom: $('#filter-date-from').val(),
            invoiceDateTo: $('#filter-date-to').val(),
            status: $('#filter-status').val()
        };
        loadData(filters);
    });

    $('#clean-filters').on('click', function () {
        loadData();
    });
});

function loadData(filters) {
    post({
        restlet: RESTLET,
        data: {
            reportType: "invoice",
            filters: filters
        },
        onSuccess: function (response) {
            if (response && response.success && Array.isArray(response.data)) {
                loadPartnerTable({ page: response });
            } else if (response.error) {
                console.error('Erro ao carregar dados do Restlet', response.error);
            } else {
                console.error('Erro ao carregar dados do Restlet', response);
            }
        }
    });
}

function loadPartnerTable(options) {
    var _listBody = $('#commission-table');
    var _listBodyContents = '';

    _listBody.children().remove();

    // 🔹 Agrupa por Invoice (tranID)
    const groupedData = {};
    options.page.data.forEach(line => {
        if (!groupedData[line.tranID]) {
            groupedData[line.tranID] = [];
        }
        groupedData[line.tranID].push(line);
    });

    _listBodyContents += `
        <div class="table-responsive" style="width: 100%; overflow-x: auto;">
        <table class="table table-striped table-bordered align-middle"
            style="--bs-table-hover-bg: transparent;">
            <thead class="table-dark text-center">
                <tr>
                    <td style="width:40px"></td> <!-- coluna da seta -->
                    <td>Invoice</td>
                    <td>Customer</td>
                    <td>Cust PO</td>
                    <td>SO/ACK</td>
                    <td>Urgency</td>
                    <td>Buyer</td>
                    <td>Cust PO Receipt</td>
                    <td>Sales ADMIN</td>
                    <td>Delivery date</td>
                    <td>Part Number</td>
                    <td>Description</td>
                    <td>QTY</td>
                    <td>Sold EA USD</td>
                    <td>Supplier/Vendor</td>
                    <td>PO Vendor</td>
                    <td>Vendor PO Date</td>
                    <td>Vendor ship Date</td>
                    <td>Vendor Terms</td>
                    <td>Stock Aloia</td>
                    <td>Date INV</td>
                    <td>Customer Invoice</td>
                    <td>Freight Aloia → Customer</td>
                    <td>Freight Vendor → Aloia</td>
                    <td>B&H Cost</td>
                    <td>Hazmat Fees</td>
                    <td>Unit cost USD</td>
                    <td>Total cost USD</td>
                    <td>Cost EA USD</td>
                    <td>Total sales sold</td>
                    <td>Operational profit USD</td>
                    <td>%</td>
                    <td>Paid by customer on</td>
                    <td>Sales commission</td>
                    <td>Commission</td>
                    <td>% customer commission</td>
                    <td>USD commission</td>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(groupedData).forEach((tranId, index) => {
        const group = groupedData[tranId];
        const first = group[0]; // primeira linha

        // 🔹 links
        const tranIdLink = first.tranID ? `<a target="_blank" href="${first.transactionUrl}">${first.tranID}</a>` : '-';
        const soAck = first.soAck ? `<a target="_blank" href="${first.soAckUrl}">${first.soAck}</a>` : '-';
        const buyer = first.buyer ? `<a target="_blank" href="${first.buyerUrl}">${first.buyer}</a>` : '-';
        const salesAdmin = first.salesAdmin ? `<a target="_blank" href="${first.salesAdminUrl}">${first.salesAdmin}</a>` : '-';
        const supplierVendor = first.supplierVendor ? `<a target="_blank" href="${first.supplierVendorUrl}">${first.supplierVendor}</a>` : '-';
        const poVendor = first.poVendor ? `<a target="_blank" href="${first.poVendorUrl}">${first.poVendor}</a>` : '-';
        const customerInvoice = first.customerInvoice ? `<a target="_blank" href="${first.customerInvoiceUrl}">${first.customerInvoice}</a>` : '-';

        // 🔹 linha principal
        _listBodyContents += `
            <tr data-group="${tranId}">
                <td class="text-center">
                    ${group.length > 1 ? `<span class="toggle-details cursor-pointer" data-target="group-${index}" style="cursor:pointer;">▶</span>` : ''}
                </td>
                <td>${tranIdLink}</td>
                <td>${first.customer}</td>
                <td>${first.custPO}</td>
                <td>${soAck}</td>
                <td>${first.urgency}</td>
                <td>${buyer}</td>
                <td>${first.custPOReceipt}</td>
                <td>${salesAdmin}</td>
                <td>${first.deliveryDate}</td>
                <td>${first.partNumber}</td>
                <td>${first.description}</td>
                <td>${first.qty}</td>
                <td>${first.soldEAUSD}</td>
                <td>${supplierVendor}</td>
                <td>${poVendor}</td>
                <td>${first.vendorPODate}</td>
                <td>${first.vendorShipDate}</td>
                <td>${first.vendorTerms}</td>
                <td>${first.stockAloia}</td>
                <td>${first.dateINV}</td>
                <td>${customerInvoice}</td>
                <td>${first.freightAloiaToCustomer}</td>
                <td>${first.freightVendorToAloia}</td>
                <td>${first.bhCost}</td>
                <td>${first.hazmatFees}</td>
                <td>${first.unitCostVendorUSD}</td>
                <td>${first.totalCostUSD}</td>
                <td>${Number(first.costEAUSD).toFixed(2)}</td>
                <td>${first.totalSalesSold}</td>
                <td>${first.operationalProfitUSD}</td>
                <td>${first.percent}</td>
                <td>${first.paidByCustomerOn}</td>
                <td>${first.salesCommission}</td>
                <td>${first.commission}</td>
                <td>${first.customerCommissionPercent}%</td>
                <td>${first.usdCommission}</td>
            </tr>
        `;

        // 🔹 linhas adicionais escondidas
        group.slice(1).forEach(line => {
            const soAck2 = line.soAck ? `<a target="_blank" href="${line.soAckUrl}">${line.soAck}</a>` : '-';
            const buyer2 = line.buyer ? `<a target="_blank" href="${line.buyerUrl}">${line.buyer}</a>` : '-';
            const salesAdmin2 = line.salesAdmin ? `<a target="_blank" href="${line.salesAdminUrl}">${line.salesAdmin}</a>` : '-';
            const supplierVendor2 = line.supplierVendor ? `<a target="_blank" href="${line.supplierVendorUrl}">${line.supplierVendor}</a>` : '-';
            const poVendor2 = line.poVendor ? `<a target="_blank" href="${line.poVendorUrl}">${line.poVendor}</a>` : '-';
            const customerInvoice2 = line.customerInvoice ? `<a target="_blank" href="${line.customerInvoiceUrl}">${line.customerInvoice}</a>` : '-';

            _listBodyContents += `
                <tr class="details-row group-${index}" style="display: none;">
                    <td></td>
                    <td></td> <!-- Invoice vazio -->
                    <td>${line.customer}</td>
                    <td>${line.custPO}</td>
                    <td>${soAck2}</td>
                    <td>${line.urgency}</td>
                    <td>${buyer2}</td>
                    <td>${line.custPOReceipt}</td>
                    <td>${salesAdmin2}</td>
                    <td>${line.deliveryDate}</td>
                    <td>${line.partNumber}</td>
                    <td>${line.description}</td>
                    <td>${line.qty}</td>
                    <td>${line.soldEAUSD}</td>
                    <td>${supplierVendor2}</td>
                    <td>${poVendor2}</td>
                    <td>${line.vendorPODate}</td>
                    <td>${line.vendorShipDate}</td>
                    <td>${line.vendorTerms}</td>
                    <td>${line.stockAloia}</td>
                    <td>${line.dateINV}</td>
                    <td>${customerInvoice2}</td>
                    <td>${line.freightAloiaToCustomer}</td>
                    <td>${line.freightVendorToAloia}</td>
                    <td>${line.bhCost}</td>
                    <td>${line.hazmatFees}</td>
                    <td>${line.unitCostVendorUSD}</td>
                    <td>${line.totalCostUSD}</td>
                    <td>${Number(line.costEAUSD).toFixed(2)}</td>
                    <td>${line.totalSalesSold}</td>
                    <td>${line.operationalProfitUSD}</td>
                    <td>${line.percent}</td>
                    <td>${line.paidByCustomerOn}</td>
                    <td>${line.salesCommission}</td>
                    <td>${line.commission}</td>
                    <td>${line.customerCommissionPercent}%</td>
                    <td>${line.usdCommission}</td>
                </tr>
            `;
        });
    });

    _listBodyContents += `
            </tbody>
        </table>
    </div>
    `;

    _listBody.append(_listBodyContents);

    // 🔹 evento expandir/retrair
    $('.toggle-details').on('click', function () {
        const target = $(this).data('target');
        const rows = $(`.details-row.${target}`);
        const isVisible = rows.is(':visible');
        rows.toggle(!isVisible);
        $(this).text(isVisible ? '▶' : '▼'); // muda seta
    });
}


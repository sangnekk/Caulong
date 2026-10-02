import DashboardController from './DashboardController'
import ReportController from './ReportController'
import SettingsController from './SettingsController'
import ProductController from './ProductController'
import OrderController from './OrderController'
import TaxonomyController from './TaxonomyController'
import CustomerController from './CustomerController'
import ImportController from './ImportController'
const Admin = {
    DashboardController: Object.assign(DashboardController, DashboardController),
ReportController: Object.assign(ReportController, ReportController),
SettingsController: Object.assign(SettingsController, SettingsController),
ProductController: Object.assign(ProductController, ProductController),
OrderController: Object.assign(OrderController, OrderController),
TaxonomyController: Object.assign(TaxonomyController, TaxonomyController),
CustomerController: Object.assign(CustomerController, CustomerController),
ImportController: Object.assign(ImportController, ImportController),
}

export default Admin
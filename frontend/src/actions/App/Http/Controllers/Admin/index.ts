import DashboardController from './DashboardController'
import ReportController from './ReportController'
import SettingsController from './SettingsController'
import SupportChatController from './SupportChatController'
import ProductController from './ProductController'
import OrderController from './OrderController'
import TaxonomyController from './TaxonomyController'
import CustomerController from './CustomerController'
import CouponController from './CouponController'
import EmailController from './EmailController'
import ReviewController from './ReviewController'
import ImportController from './ImportController'
const Admin = {
    DashboardController: Object.assign(DashboardController, DashboardController),
ReportController: Object.assign(ReportController, ReportController),
SettingsController: Object.assign(SettingsController, SettingsController),
SupportChatController: Object.assign(SupportChatController, SupportChatController),
ProductController: Object.assign(ProductController, ProductController),
OrderController: Object.assign(OrderController, OrderController),
TaxonomyController: Object.assign(TaxonomyController, TaxonomyController),
CustomerController: Object.assign(CustomerController, CustomerController),
CouponController: Object.assign(CouponController, CouponController),
EmailController: Object.assign(EmailController, EmailController),
ReviewController: Object.assign(ReviewController, ReviewController),
ImportController: Object.assign(ImportController, ImportController),
}

export default Admin
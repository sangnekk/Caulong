import DashboardController from './DashboardController'
import SupportChatController from './SupportChatController'
import ReportController from './ReportController'
import SettingsController from './SettingsController'
import OrderController from './OrderController'
import StaffController from './StaffController'
import ProductController from './ProductController'
import TaxonomyController from './TaxonomyController'
import CustomerController from './CustomerController'
import CouponController from './CouponController'
import EmailController from './EmailController'
import ReviewController from './ReviewController'
import ImportController from './ImportController'
import ServiceOrderController from './ServiceOrderController'
import ServiceStringController from './ServiceStringController'
const Admin = {
    DashboardController: Object.assign(DashboardController, DashboardController),
SupportChatController: Object.assign(SupportChatController, SupportChatController),
ReportController: Object.assign(ReportController, ReportController),
SettingsController: Object.assign(SettingsController, SettingsController),
OrderController: Object.assign(OrderController, OrderController),
StaffController: Object.assign(StaffController, StaffController),
ProductController: Object.assign(ProductController, ProductController),
TaxonomyController: Object.assign(TaxonomyController, TaxonomyController),
CustomerController: Object.assign(CustomerController, CustomerController),
CouponController: Object.assign(CouponController, CouponController),
EmailController: Object.assign(EmailController, EmailController),
ReviewController: Object.assign(ReviewController, ReviewController),
ImportController: Object.assign(ImportController, ImportController),
ServiceOrderController: Object.assign(ServiceOrderController, ServiceOrderController),
ServiceStringController: Object.assign(ServiceStringController, ServiceStringController),
}

export default Admin
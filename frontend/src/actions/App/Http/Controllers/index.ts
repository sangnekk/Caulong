import AccountController from './AccountController'
import Settings from './Settings'
import CatalogController from './CatalogController'
import RecommendationController from './RecommendationController'
import CartController from './CartController'
import CheckoutController from './CheckoutController'
import CustomerEventController from './CustomerEventController'
import MarketingConsentController from './MarketingConsentController'
import WishlistController from './WishlistController'
import ReviewController from './ReviewController'
import ServiceOrderController from './ServiceOrderController'
import SupportChatController from './SupportChatController'
import Admin from './Admin'
import AdvisorController from './AdvisorController'
const Controllers = {
    AccountController: Object.assign(AccountController, AccountController),
Settings: Object.assign(Settings, Settings),
CatalogController: Object.assign(CatalogController, CatalogController),
RecommendationController: Object.assign(RecommendationController, RecommendationController),
CartController: Object.assign(CartController, CartController),
CheckoutController: Object.assign(CheckoutController, CheckoutController),
CustomerEventController: Object.assign(CustomerEventController, CustomerEventController),
MarketingConsentController: Object.assign(MarketingConsentController, MarketingConsentController),
WishlistController: Object.assign(WishlistController, WishlistController),
ReviewController: Object.assign(ReviewController, ReviewController),
ServiceOrderController: Object.assign(ServiceOrderController, ServiceOrderController),
SupportChatController: Object.assign(SupportChatController, SupportChatController),
Admin: Object.assign(Admin, Admin),
AdvisorController: Object.assign(AdvisorController, AdvisorController),
}

export default Controllers
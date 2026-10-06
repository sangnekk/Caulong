import AccountController from './AccountController'
import Settings from './Settings'
import CatalogController from './CatalogController'
import CartController from './CartController'
import CheckoutController from './CheckoutController'
import SupportChatController from './SupportChatController'
import Admin from './Admin'
import AdvisorController from './AdvisorController'
const Controllers = {
    AccountController: Object.assign(AccountController, AccountController),
Settings: Object.assign(Settings, Settings),
CatalogController: Object.assign(CatalogController, CatalogController),
CartController: Object.assign(CartController, CartController),
CheckoutController: Object.assign(CheckoutController, CheckoutController),
SupportChatController: Object.assign(SupportChatController, SupportChatController),
Admin: Object.assign(Admin, Admin),
AdvisorController: Object.assign(AdvisorController, AdvisorController),
}

export default Controllers
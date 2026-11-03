import checkout from '../lib/mercadopago.js';
import { adapt } from '../lib/function-adapter.mjs';
export default adapt(checkout.paymentStatusHandler());

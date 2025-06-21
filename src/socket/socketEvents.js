import SocketEvents from './SockEvents.js';
import MessageBroker from './MessageBroker.js';
import { SHARD_NAME } from '../core/config.js';

/*
 * if we are a shard in a cluster, do messaging to others via redis
 */
const socketEvents = (SHARD_NAME) ? new MessageBroker() : new SocketEvents();

export default socketEvents;

import { TwoPhaseCommitCoordinator, TransactionState } from './2pc-coordinator';
import { GenericTwoPhaseCommitParticipant } from './2pc-participant';

async function runSimulation() {
  const coordinator = new TwoPhaseCommitCoordinator();

  const paymentService = new GenericTwoPhaseCommitParticipant('PaymentService');
  const inventoryService = new GenericTwoPhaseCommitParticipant('InventoryService');
  const notificationService = new GenericTwoPhaseCommitParticipant('NotificationService');

  coordinator.addParticipant(paymentService);
  coordinator.addParticipant(inventoryService);
  coordinator.addParticipant(notificationService);

  console.log('\n--- Scenario 1: All participants commit ---');
  const transactionData1 = {
    userId: 'user-123',
    orderId: 'order-abc',
    amount: 100,
    itemId: 'item-xyz',
    quantity: 2
  };
  const result1 = await coordinator.executeTransaction(transactionData1);
  console.log(`Simulation 1 Result: ${result1 === TransactionState.COMMITTED ? 'SUCCESS' : 'FAILURE'}`);

  console.log('\n--- Scenario 2: One participant aborts during prepare ---');
  const transactionData2 = {
    userId: 'user-456',
    orderId: 'order-def',
    amount: 50,
    itemId: 'item-qwe',
    quantity: 1,
    fail_prepare: 'InventoryService' // This participant will vote ABORT
  };
  const result2 = await coordinator.executeTransaction(transactionData2);
  console.log(`Simulation 2 Result: ${result2 === TransactionState.COMMITTED ? 'SUCCESS' : 'FAILURE'}`);

  console.log('\n--- Scenario 3: Another participant aborts during prepare ---');
  const transactionData3 = {
    userId: 'user-789',
    orderId: 'order-ghi',
    amount: 250,
    itemId: 'item-rty',
    quantity: 5,
    fail_prepare: 'PaymentService' // This participant will vote ABORT
  };
  const result3 = await coordinator.executeTransaction(transactionData3);
  console.log(`Simulation 3 Result: ${result3 === TransactionState.COMMITTED ? 'SUCCESS' : 'FAILURE'}`);
}

runSimulation().catch(error => {
  console.error('Simulation failed:', error);
});

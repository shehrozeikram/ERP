import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PaymentSettlementForm from './PaymentSettlementForm';
import PaymentSettlementList from './PaymentSettlementList';

const PaymentSettlement = () => {
  const { action, id } = useParams();
  const navigate = useNavigate();

  const handleSave = () => {
    navigate('/admin/payment-settlement');
  };

  const handleCancel = () => {
    navigate('/admin/payment-settlement');
  };

  if (action === 'create') {
    return (
      <PaymentSettlementForm
        onSave={handleSave}
        onCancel={handleCancel}
        isEdit={false}
      />
    );
  }

  if (action === 'edit' && id) {
    return (
      <PaymentSettlementForm
        settlementId={id}
        onSave={handleSave}
        onCancel={handleCancel}
        isEdit={true}
      />
    );
  }

  return <PaymentSettlementList />;
};

export default PaymentSettlement;

/**
 * Reusable hook for adding new items (Location, Qualification, Project, etc.)
 * Lightweight and optimized
 */
import { useState } from 'react';
import api from '../services/api';

const useAddItem = (endpoint, options = {}) => {
  const {
    itemName = 'item',
    onSuccess,
    onError,
    transformPayload = (data) => data,
    getItemValue = (item) => item._id,
    getItemName = (item) => item.name
  } = options;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (refreshCallback) => {
    if (!formData.name?.trim()) {
      return { success: false, message: `${itemName} name is required` };
    }

    try {
      setLoading(true);
      const payload = transformPayload(formData);
      const response = await api.post(endpoint, payload);
      
      const newItem = response.data.data;
      
      // Refresh the list
      if (refreshCallback) {
        await refreshCallback();
      }

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(newItem);
      }

      // Reset form
      setFormData({});
      setDialogOpen(false);

      return {
        success: true,
        message: `${itemName} added successfully`,
        data: newItem,
        value: getItemValue(newItem),
        name: getItemName(newItem)
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
                          (error.response?.data?.errors?.[0]?.msg) ||
                          `Error adding ${itemName}`;
      
      if (onError) {
        onError(error);
      }

      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFormData({});
    setDialogOpen(false);
  };

  return {
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    loading,
    handleChange,
    handleSave,
    reset
  };
};

export default useAddItem;


import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // Data state
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [sections, setSections] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [projects, setProjects] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState({
    departments: false,
    employees: false,
    positions: false,
    banks: false,
    companies: false,
    sectors: false,
    locations: false,
    countries: false,
    provinces: false,
    cities: false,
    sections: false,
    designations: false,
    projects: false
  });
  
  // Error states
  const [errors, setErrors] = useState({});
  
  // Cache timestamps
  const [lastFetched, setLastFetched] = useState({});
  
  // Preload state to prevent multiple calls
  const [isPreloading, setIsPreloading] = useState(false);
  
  // Ref to track if data has been loaded to prevent multiple calls
  const hasLoadedData = useRef(false);
  
  // Cache duration (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;
  
  // Check if data is stale
  const isDataStale = useCallback((dataType) => {
    const lastFetch = lastFetched[dataType];
    if (!lastFetch) return true;
    return Date.now() - lastFetch > CACHE_DURATION;
  }, [lastFetched, CACHE_DURATION]);
  
  // Fetch departments
  const fetchDepartments = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && departments.length > 0 && !isDataStale('departments')) {
      return departments;
    }
    
    try {
      setLoading(prev => ({ ...prev, departments: true }));
      setErrors(prev => ({ ...prev, departments: null }));
      
      const response = await api.get('/hr/departments');
      const data = response.data.data || [];
      
      setDepartments(data);
      setLastFetched(prev => ({ ...prev, departments: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching departments:', error);
      setErrors(prev => ({ ...prev, departments: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, departments: false }));
    }
  }, [isAuthenticated, departments, isDataStale]);
  
  // Fetch employees
  const fetchEmployees = useCallback(async (force = false) => {
    if (!isAuthenticated) return employees;
    
    if (!force && employees.length > 0 && !isDataStale('employees')) {
      return employees;
    }
    
    try {
      setLoading(prev => ({ ...prev, employees: true }));
      setErrors(prev => ({ ...prev, employees: null }));
      
      console.log('📡 fetchEmployees: Fetching employees from API...', { force });
      const response = await api.get('/hr/employees?getAll=true');
      const data = response.data.data || [];
      
      console.log(`✅ fetchEmployees: Fetched ${data.length} employees`);
      setEmployees(data);
      setLastFetched(prev => ({ ...prev, employees: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load employees';
      setErrors(prev => ({ ...prev, employees: errorMessage }));
      // Don't set lastFetched on error - allows retry
      return employees; // Return existing employees if any, or empty array
    } finally {
      setLoading(prev => ({ ...prev, employees: false }));
    }
  }, [isAuthenticated, employees, isDataStale]);
  
  // Fetch positions
  const fetchPositions = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && positions.length > 0 && !isDataStale('positions')) {
      return positions;
    }
    
    try {
      setLoading(prev => ({ ...prev, positions: true }));
      setErrors(prev => ({ ...prev, positions: null }));
      
      const response = await api.get('/positions');
      const data = response.data.data || [];
      
      setPositions(data);
      setLastFetched(prev => ({ ...prev, positions: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching positions:', error);
      setErrors(prev => ({ ...prev, positions: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, positions: false }));
    }
  }, [isAuthenticated, positions, isDataStale]);
  
  // Fetch banks
  const fetchBanks = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && banks.length > 0 && !isDataStale('banks')) {
      return banks;
    }
    
    try {
      setLoading(prev => ({ ...prev, banks: true }));
      setErrors(prev => ({ ...prev, banks: null }));
      
      const response = await api.get('/hr/banks');
      const data = response.data.data || [];
      
      setBanks(data);
      setLastFetched(prev => ({ ...prev, banks: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching banks:', error);
      setErrors(prev => ({ ...prev, banks: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, banks: false }));
    }
  }, [isAuthenticated, banks, isDataStale]);
  
  // Fetch companies
  const fetchCompanies = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && companies.length > 0 && !isDataStale('companies')) {
      return companies;
    }
    
    try {
      setLoading(prev => ({ ...prev, companies: true }));
      setErrors(prev => ({ ...prev, companies: null }));
      
      const response = await api.get('/hr/companies');
      const data = response.data.data || [];
      
      setCompanies(data);
      setLastFetched(prev => ({ ...prev, companies: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching companies:', error);
      setErrors(prev => ({ ...prev, companies: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, companies: false }));
    }
  }, [isAuthenticated, companies, isDataStale]);
  
  // Fetch sectors
  const fetchSectors = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && sectors.length > 0 && !isDataStale('sectors')) {
      return sectors;
    }
    
    try {
      setLoading(prev => ({ ...prev, sectors: true }));
      setErrors(prev => ({ ...prev, sectors: null }));
      
      const response = await api.get('/hr/sectors');
      const data = response.data.data || [];
      
      setSectors(data);
      setLastFetched(prev => ({ ...prev, sectors: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching sectors:', error);
      setErrors(prev => ({ ...prev, sectors: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, sectors: false }));
    }
  }, [isAuthenticated, sectors, isDataStale]);
  
  // Fetch locations
  const fetchLocations = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && locations.length > 0 && !isDataStale('locations')) {
      return locations;
    }
    
    try {
      setLoading(prev => ({ ...prev, locations: true }));
      setErrors(prev => ({ ...prev, locations: null }));
      
      const response = await api.get('/locations');
      const data = response.data.data || [];
      
      setLocations(data);
      setLastFetched(prev => ({ ...prev, locations: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching locations:', error);
      setErrors(prev => ({ ...prev, locations: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, locations: false }));
    }
  }, [isAuthenticated, locations, isDataStale]);
  
  // Fetch countries
  const fetchCountries = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && countries.length > 0 && !isDataStale('countries')) {
      return countries;
    }
    
    try {
      setLoading(prev => ({ ...prev, countries: true }));
      setErrors(prev => ({ ...prev, countries: null }));
      
      const response = await api.get('/countries');
      const data = response.data.data || [];
      
      setCountries(data);
      setLastFetched(prev => ({ ...prev, countries: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching countries:', error);
      setErrors(prev => ({ ...prev, countries: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, countries: false }));
    }
  }, [isAuthenticated, countries, isDataStale]);
  
  // Fetch provinces
  const fetchProvinces = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && provinces.length > 0 && !isDataStale('provinces')) {
      return provinces;
    }
    
    try {
      setLoading(prev => ({ ...prev, provinces: true }));
      setErrors(prev => ({ ...prev, provinces: null }));
      
      const response = await api.get('/provinces');
      const data = response.data.data || [];
      
      setProvinces(data);
      setLastFetched(prev => ({ ...prev, provinces: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching provinces:', error);
      setErrors(prev => ({ ...prev, provinces: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, provinces: false }));
    }
  }, [isAuthenticated, provinces, isDataStale]);
  
  // Fetch cities
  const fetchCities = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && cities.length > 0 && !isDataStale('cities')) {
      return cities;
    }
    
    try {
      setLoading(prev => ({ ...prev, cities: true }));
      setErrors(prev => ({ ...prev, cities: null }));
      
      const response = await api.get('/cities');
      const data = response.data.data || [];
      
      setCities(data);
      setLastFetched(prev => ({ ...prev, cities: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching cities:', error);
      setErrors(prev => ({ ...prev, cities: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, cities: false }));
    }
  }, [isAuthenticated, cities, isDataStale]);
  
  // Fetch sections
  const fetchSections = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && sections.length > 0 && !isDataStale('sections')) {
      return sections;
    }
    
    try {
      setLoading(prev => ({ ...prev, sections: true }));
      setErrors(prev => ({ ...prev, sections: null }));
      
      const response = await api.get('/sections');
      const data = response.data.data || [];
      
      setSections(data);
      setLastFetched(prev => ({ ...prev, sections: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching sections:', error);
      setErrors(prev => ({ ...prev, sections: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, sections: false }));
    }
  }, [isAuthenticated, sections, isDataStale]);
  
  // Fetch designations
  const fetchDesignations = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && designations.length > 0 && !isDataStale('designations')) {
      return designations;
    }
    
    try {
      setLoading(prev => ({ ...prev, designations: true }));
      setErrors(prev => ({ ...prev, designations: null }));
      
      const response = await api.get('/designations');
      const data = response.data.data || [];
      
      setDesignations(data);
      setLastFetched(prev => ({ ...prev, designations: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching designations:', error);
      setErrors(prev => ({ ...prev, designations: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, designations: false }));
    }
  }, [isAuthenticated, designations, isDataStale]);
  
  // Fetch projects
  const fetchProjects = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    if (!force && projects.length > 0 && !isDataStale('projects')) {
      return projects;
    }
    
    try {
      setLoading(prev => ({ ...prev, projects: true }));
      setErrors(prev => ({ ...prev, projects: null }));
      
      const response = await api.get('/projects');
      const data = response.data.data || [];
      
      setProjects(data);
      setLastFetched(prev => ({ ...prev, projects: Date.now() }));
      
      return data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      setErrors(prev => ({ ...prev, projects: error.message }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  }, [isAuthenticated, projects, isDataStale]);
  
  // Preload essential HR data
  const preloadHRData = useCallback(async () => {
    if (!isAuthenticated || isPreloading) return;
    
    // Check if data is already loaded to prevent duplicate calls
    if (departments.length > 0 && employees.length > 0 && positions.length > 0 && banks.length > 0 && companies.length > 0) {
      console.log('📦 HR data already loaded, skipping preload');
      return;
    }
    
    console.log('🚀 Preloading essential HR data...');
    setIsPreloading(true);
    
    try {
      // Load most commonly used data in parallel
      await Promise.all([
        fetchDepartments(),
        fetchEmployees(),
        fetchPositions(),
        fetchBanks(),
        fetchCompanies()
      ]);
      
      console.log('✅ Essential HR data preloaded successfully');
    } catch (error) {
      console.error('❌ Error preloading HR data:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [isAuthenticated, isPreloading, departments.length, employees.length, positions.length, banks.length, companies.length, fetchDepartments, fetchEmployees, fetchPositions, fetchBanks, fetchCompanies]);
  
  // Clear all data (useful for logout)
  const clearData = useCallback(() => {
    setDepartments([]);
    setEmployees([]);
    setPositions([]);
    setBanks([]);
    setCompanies([]);
    setSectors([]);
    setLocations([]);
    setCountries([]);
    setProvinces([]);
    setCities([]);
    setSections([]);
    setDesignations([]);
    setProjects([]);
    setLastFetched({});
    setErrors({});
    setIsPreloading(false);
    hasLoadedData.current = false;
  }, []);
  
  // Lazy load data when authenticated - delay preload to improve initial page load
  useEffect(() => {
    let preloadTimer = null;
    let isMounted = true;
    
    // Allow loading if authenticated, not currently preloading, and haven't successfully loaded yet
    // Use lastFetched.employees as the source of truth - if it exists, we've loaded (even if array is empty)
    const hasSuccessfullyFetched = !!lastFetched.employees;
    const shouldLoad = isAuthenticated && !isPreloading && !hasLoadedData.current && !hasSuccessfullyFetched;
    
    if (shouldLoad) {
      console.log('📦 DataContext: Starting data preload...', { 
        employeesCount: employees.length, 
        hasLoadedData: hasLoadedData.current,
        lastFetchedEmployees: lastFetched.employees 
      });
      hasLoadedData.current = true;
      
      // Delay preload by 500ms to allow initial page render first (lazy loading)
      preloadTimer = setTimeout(() => {
        if (!isMounted) return;
        
        console.log('🚀 Preloading essential HR data...');
        setIsPreloading(true);
        
        // Set loading states to true
        setLoading(prev => ({
          ...prev,
          departments: true,
          employees: true,
          positions: true,
          banks: true,
          companies: true,
          projects: true
        }));
      
        // Load data directly without using the fetch functions to avoid dependency issues
        // Load employees separately with longer timeout to avoid blocking other data
        const loadData = async () => {
          try {
            console.log('📡 Fetching HR data from API...');
            // Load non-employee data first (faster)
            const [departmentsRes, positionsRes, banksRes, companiesRes, projectsRes] = await Promise.all([
              api.get('/hr/departments'),
              api.get('/positions'),
              api.get('/hr/banks'),
              api.get('/hr/companies'),
              api.get('/projects')
            ]);
            
            if (!isMounted) return;
            
            setDepartments(departmentsRes.data.data || []);
            setPositions(positionsRes.data.data || []);
            setBanks(banksRes.data.data || []);
            setCompanies(companiesRes.data.data || []);
            setProjects(projectsRes.data.data || []);
            
            // Set cache timestamps for non-employee data
            const now = Date.now();
            setLastFetched(prev => ({
              ...prev,
              departments: now,
              positions: now,
              banks: now,
              companies: now,
              projects: now
            }));
            
            // Set loading states to false for non-employee data
            setLoading(prev => ({
              ...prev,
              departments: false,
              positions: false,
              banks: false,
              companies: false,
              projects: false
            }));
            
            console.log(`✅ Essential HR data (non-employees) preloaded successfully: ${departmentsRes.data.data?.length || 0} departments, ${projectsRes.data.data?.length || 0} projects`);
            
            // Load employees separately (may take longer)
            try {
              console.log('📡 Fetching employees from API...');
              const employeesRes = await api.get('/hr/employees?getAll=true');
              
              if (!isMounted) return;
              
              const employeesData = employeesRes.data.data || [];
              setEmployees(employeesData);
              setLastFetched(prev => ({ ...prev, employees: Date.now() }));
              setLoading(prev => ({ ...prev, employees: false }));
              setErrors(prev => ({ ...prev, employees: null }));
              console.log(`✅ Employees preloaded successfully: ${employeesData.length} employees`);
            } catch (employeeError) {
              if (!isMounted) return;
              
              console.error('❌ Error preloading employees:', employeeError);
              setErrors(prev => ({
                ...prev,
                employees: employeeError.response?.data?.message || employeeError.message || 'Failed to load employees. Please refresh the page.'
              }));
              setLoading(prev => ({ ...prev, employees: false }));
              // Reset hasLoadedData to allow retry
              hasLoadedData.current = false;
            }
            
          } catch (error) {
            if (!isMounted) return;
            
            console.error('❌ Error preloading HR data:', error);
            // Set error states for failed requests
            setErrors(prev => ({
              ...prev,
              departments: error.response?.data?.message || error.message,
              positions: error.response?.data?.message || error.message,
              banks: error.response?.data?.message || error.message,
              companies: error.response?.data?.message || error.message,
              projects: error.response?.data?.message || error.message
            }));
            // Set loading states to false for failed requests
            setLoading(prev => ({
              ...prev,
              departments: false,
              positions: false,
              banks: false,
              companies: false,
              projects: false
            }));
            // Reset hasLoadedData to allow retry
            hasLoadedData.current = false;
          } finally {
            if (isMounted) {
              setIsPreloading(false);
            }
          }
        };
        
        loadData();
      }, 500); // Delay by 500ms for lazy loading (allows initial page render first)
    } else if (!isAuthenticated) {
      clearData();
      hasLoadedData.current = false;
    }
    
    // Cleanup timeout on unmount
    return () => {
      isMounted = false;
      if (preloadTimer) {
        clearTimeout(preloadTimer);
      }
    };
  }, [isAuthenticated, clearData]); // Only depend on auth state - don't cause re-runs on data changes
  
  const contextValue = {
    // Data
    departments,
    employees,
    positions,
    banks,
    companies,
    sectors,
    locations,
    countries,
    provinces,
    cities,
    sections,
    designations,
    projects,
    
    // Loading states
    loading,
    
    // Error states
    errors,
    
    // Fetch functions
    fetchDepartments,
    fetchEmployees,
    fetchPositions,
    fetchBanks,
    fetchCompanies,
    fetchSectors,
    fetchLocations,
    fetchCountries,
    fetchProvinces,
    fetchCities,
    fetchSections,
    fetchDesignations,
    fetchProjects,
    
    // Utility functions
    preloadHRData,
    clearData,
    
    // Check if data is stale
    isDataStale
  };
  
  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

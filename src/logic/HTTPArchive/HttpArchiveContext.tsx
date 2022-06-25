import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsContext } from '../SettingsContext';
import { isJsonRpcRequest, getPreparedRequest } from './filters';
import { IRequest } from './IRequest';

const useRequest = () => {
  const [selected, setSelected] = useState<IRequest>(null);
  const [requests, setRequests] = useState<IRequest[]>([]);
  const requestsRef = useRef<IRequest[]>([]);

  const { preserveLog } = useSettingsContext();

  const clear = () => {
    requestsRef.current = [];
    setRequests(requestsRef.current);
    setSelected(null);
  };

  const clearSelection = () => {
    setSelected(null);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selected) {
      return;
    }

    let index = requests.findIndex(({ uuid }) => selected.uuid === uuid);

    if (e.key === 'ArrowUp') {
      index -= 1;
    } else if (e.key === 'ArrowDown') {
      index += 1;
    }

    if (index < 0) {
      setSelected(requests[requests.length - 1]);
    } else if (index > requests.length - 1) {
      setSelected(requests[0]);
    } else {
      setSelected(requests[index]);
    }
  }, [requests, selected]);

  const handleInitialRequestsData = useCallback(async (e: CustomEvent<chrome.devtools.network.Request[]>) => {
    const requests = await Promise.all(
      e.detail.filter(isJsonRpcRequest).map((item) => getPreparedRequest(item))
    );

    requestsRef.current = [
      ...requestsRef.current,
      ...requests.flat()
    ];

    setRequests(requestsRef.current);
  }, [requestsRef.current, setRequests]);

  const handleNavigation = useCallback(() => {
    requestsRef.current = [];
    setRequests(requestsRef.current);
  }, [requestsRef.current, setRequests]);

  const handleRequest = useCallback(async (request: chrome.devtools.network.Request) => {
    if (isJsonRpcRequest(request)) {
      const preparedRequest = await getPreparedRequest(request);

      requestsRef.current = [
        ...requestsRef.current,
        ...preparedRequest
      ];

      setRequests(requestsRef.current);
    }
  }, [requestsRef.current, setRequests]);

  useEffect(() => {
    chrome.devtools.network.onRequestFinished.addListener(handleRequest);
    !preserveLog && chrome.devtools.network.onNavigated.addListener(handleNavigation);
    window.addEventListener('INITIAL_REQUESTS_DATA', handleInitialRequestsData);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(handleRequest);
      !preserveLog && chrome.devtools.network.onNavigated.removeListener(handleNavigation);
      window.removeEventListener('INITIAL_REQUESTS_DATA', handleInitialRequestsData);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [requests, selected]);

  return {
    requests,
    selected,
    setSelected,
    clear,
    clearSelection
  };
};

type RequestContextType = ReturnType<typeof useRequest>;

export const RequestContext = createContext<RequestContextType>(null);

export const useRequestContext = (): RequestContextType => (
  useContext<RequestContextType>(RequestContext)
);

interface IProps {
  children: React.ReactElement
}

const RequestContextProvider: React.FC<IProps> = ({ children }) => (
  <RequestContext.Provider value={ useRequest() }>
    { children }
  </RequestContext.Provider>
);

export default RequestContextProvider;

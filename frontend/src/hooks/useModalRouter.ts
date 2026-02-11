import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export function useModalRouter() {
    const navigate = useNavigate()
    const location = useLocation()

    const [backgroundLocation, setBackgroundLocation] = useState(location.pathname)

    const searchParams = new URLSearchParams(location.search)
    const modal = searchParams.get('modal')

    const openModal = (modalName: string) => {
        setBackgroundLocation(location.pathname)

        const newSearch = new URLSearchParams(location.search)

        newSearch.set('modal', modalName)

        navigate(`${location.pathname}?${newSearch.toString()}`)
    }

    const closeModal = () => {
        const newSearch = new URLSearchParams(location.search)
        newSearch.delete('modal')

        const queryString = newSearch.toString()
        const newUrl = queryString ? `${backgroundLocation}?${queryString}` : backgroundLocation

        navigate(newUrl)
    }

    return {
        modal,
        openModal,
        closeModal,
    }
}
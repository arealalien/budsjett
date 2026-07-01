import React, {
    Children,
    isValidElement,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';

function renderIcon(icon, className = '') {
    if (!icon) return null;

    if (typeof icon === 'string' || typeof icon === 'number') {
        return (
            <span className={`material-symbols-rounded ${className}`} aria-hidden="true">
                {icon}
            </span>
        );
    }

    return (
        <span className={className} aria-hidden="true">
            {icon}
        </span>
    );
}

function toCssColor(color) {
    if (!color) return null;

    const value = String(color).trim();
    if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(value)) return `rgb(${value})`;

    return value;
}

export default function Dropdown({
    options = [],
    children,

    value,
    defaultValue = '',
    onValueChange,
    onChange,
    multiple = false,

    name,
    id,
    required = false,

    placeholder = 'Select',
    variant = 'gray',
    colorFromSelected = false,
    disabled = false,
    searchable = false,
    searchPlaceholder = 'Search...',
    noResultsText = 'No options found',

    leftIcon = null,
    rightIcon = 'expand_more',

    className = '',
    style,
    ...props
}) {
    const generatedId = useId();
    const dropdownId = id ?? `dropdown-${generatedId}`;
    const listboxId = `${dropdownId}-listbox`;

    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const searchRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [searchQuery, setSearchQuery] = useState('');

    const normalizedOptions = useMemo(() => {
        const sourceOptions = options.length
            ? options
            : Children.toArray(children)
                .filter(isValidElement)
                .map((child) => ({
                    value: child.props.value ?? child.props.children,
                    label: child.props.children,
                    disabled: child.props.disabled,
                }));

        return sourceOptions.map((option, index) => ({
            value: option.value,
            stringValue: String(option.value),
            label: option.label ?? String(option.value),
            icon: option.icon ?? null,
            color: toCssColor(option.color),
            variant: option.variant ?? 'default',
            disabled: Boolean(option.disabled),
            searchText: String(
                option.searchText ??
                option.label ??
                option.value ??
                ''
            ).toLowerCase(),
            index,
        }));
    }, [children, options]);

    const filteredOptions = useMemo(() => {
        if (!searchable) return normalizedOptions;

        const query = searchQuery.trim().toLowerCase();
        if (!query) return normalizedOptions;

        return normalizedOptions.filter((option) =>
            option.searchText.includes(query) ||
            option.stringValue.toLowerCase().includes(query)
        );
    }, [normalizedOptions, searchable, searchQuery]);

    const isControlled = value !== undefined;
    const selectedValue = isControlled ? value : internalValue;
    const selectedValues = multiple
        ? (Array.isArray(selectedValue) ? selectedValue : [selectedValue])
            .filter((item) => item !== undefined && item !== null && item !== '')
            .map(String)
        : [];

    const selectedIndex = normalizedOptions.findIndex(
        (option) => option.stringValue === String(selectedValue)
    );

    const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;
    const selectedOptions = multiple
        ? normalizedOptions.filter((option) => selectedValues.includes(option.stringValue))
        : [];
    const accentOption = selectedOption || selectedOptions[0] || null;

    const resolvedVariant =
        colorFromSelected && accentOption?.variant
            ? accentOption.variant
            : variant;

    const selectedLabel = (() => {
        if (!multiple) return selectedOption?.label ?? placeholder;
        if (!selectedOptions.length) return placeholder;
        if (selectedOptions.length <= 2) {
            return selectedOptions.map((option) => option.label).join(', ');
        }
        return `${selectedOptions.length} selected`;
    })();

    const rootStyle = useMemo(() => {
        const nextStyle = { ...style };

        if (colorFromSelected && accentOption?.color) {
            nextStyle['--dropdown-accent'] = accentOption.color;
        }

        return nextStyle;
    }, [accentOption?.color, colorFromSelected, style]);

    function optionByIndex(index) {
        return normalizedOptions.find((option) => option.index === index) ?? null;
    }

    function getFirstEnabledIndex(list = filteredOptions) {
        const option = list.find((item) => !item.disabled);
        return option ? option.index : -1;
    }

    function getLastEnabledIndex(list = filteredOptions) {
        for (let i = list.length - 1; i >= 0; i -= 1) {
            if (!list[i].disabled) return list[i].index;
        }

        return -1;
    }

    function getNextEnabledIndex(startIndex, direction, list = filteredOptions) {
        if (!list.length) return -1;

        let index = list.findIndex((option) => option.index === startIndex);
        if (index < 0) {
            index = direction > 0 ? -1 : list.length;
        }

        for (let i = 0; i < list.length; i += 1) {
            index = (index + direction + list.length) % list.length;

            if (!list[index].disabled) {
                return list[index].index;
            }
        }

        return -1;
    }

    function openDropdown(initialSearch = '') {
        if (disabled) return;

        if (searchable && initialSearch) {
            setSearchQuery(initialSearch);
        }

        const fallbackIndex =
            selectedIndex >= 0
                ? selectedIndex
                : multiple && selectedOptions.length
                    ? normalizedOptions.findIndex((option) => option.stringValue === selectedOptions[0].stringValue)
                    : getFirstEnabledIndex();

        setIsOpen(true);
        setFocusedIndex(fallbackIndex);
    }

    function closeDropdown() {
        setIsOpen(false);
        setFocusedIndex(-1);
        setSearchQuery('');
    }

    function emitChange(nextValue, option) {
        onValueChange?.(nextValue, option);
        onChange?.({ target: { name, value: nextValue } });
    }

    function selectOption(option) {
        if (!option || option.disabled) return;

        if (multiple) {
            const hasValue = selectedValues.includes(option.stringValue);
            const nextValue = hasValue
                ? selectedValues.filter((item) => item !== option.stringValue)
                : [...selectedValues, option.stringValue];

            if (!isControlled) {
                setInternalValue(nextValue);
            }

            emitChange(nextValue, option);
            window.requestAnimationFrame(() => {
                searchRef.current?.focus();
            });
            return;
        }

        if (!isControlled) {
            setInternalValue(option.value);
        }

        emitChange(option.value, option);
        closeDropdown();

        window.requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
    }

    function handleKeyDown(event) {
        if (disabled) return;

        if (
            searchable &&
            !isOpen &&
            event.key.length === 1 &&
            event.key !== ' ' &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
        ) {
            event.preventDefault();
            openDropdown(event.key);
            return;
        }

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();

                if (!isOpen) {
                    openDropdown();
                    return;
                }

                setFocusedIndex((currentIndex) =>
                    getNextEnabledIndex(currentIndex >= 0 ? currentIndex : selectedIndex, 1)
                );
                break;
            }

            case 'ArrowUp': {
                event.preventDefault();

                if (!isOpen) {
                    openDropdown();
                    return;
                }

                setFocusedIndex((currentIndex) =>
                    getNextEnabledIndex(currentIndex >= 0 ? currentIndex : selectedIndex, -1)
                );
                break;
            }

            case 'Home': {
                event.preventDefault();
                if (isOpen) setFocusedIndex(getFirstEnabledIndex());
                break;
            }

            case 'End': {
                event.preventDefault();
                if (isOpen) setFocusedIndex(getLastEnabledIndex());
                break;
            }

            case 'Enter':
            case ' ': {
                event.preventDefault();

                if (!isOpen) {
                    openDropdown();
                    return;
                }

                selectOption(optionByIndex(focusedIndex));
                break;
            }

            case 'Escape': {
                event.preventDefault();
                closeDropdown();
                break;
            }

            default:
                break;
        }
    }

    function handleSearchKeyDown(event) {
        if (disabled) return;

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                setFocusedIndex((currentIndex) => getNextEnabledIndex(currentIndex, 1));
                break;
            }

            case 'ArrowUp': {
                event.preventDefault();
                setFocusedIndex((currentIndex) => getNextEnabledIndex(currentIndex, -1));
                break;
            }

            case 'Enter': {
                event.preventDefault();
                selectOption(optionByIndex(focusedIndex));
                break;
            }

            case 'Escape': {
                event.preventDefault();
                closeDropdown();
                window.requestAnimationFrame(() => {
                    triggerRef.current?.focus();
                });
                break;
            }

            default:
                break;
        }
    }

    useEffect(() => {
        if (!isOpen) return undefined;

        function handlePointerDown(event) {
            if (!rootRef.current?.contains(event.target)) {
                closeDropdown();
            }
        }

        window.addEventListener('pointerdown', handlePointerDown);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !searchable) return;

        window.requestAnimationFrame(() => {
            searchRef.current?.focus();
        });
    }, [isOpen, searchable]);

    useEffect(() => {
        if (!isOpen) return;

        const focusedOption = filteredOptions.find((option) => option.index === focusedIndex);
        if (focusedOption && !focusedOption.disabled) return;

        const nextOption = filteredOptions.find((option) => !option.disabled);
        setFocusedIndex(nextOption ? nextOption.index : -1);
    }, [filteredOptions, focusedIndex, isOpen]);

    return (
        <div
            ref={rootRef}
            className={[
                'dropdown',
                `dropdown-${resolvedVariant}`,
                colorFromSelected ? 'dropdown-color-from-selected' : '',
                isOpen ? 'is-open' : '',
                disabled ? 'is-disabled' : '',
                className,
            ].filter(Boolean).join(' ')}
            data-state={isOpen ? 'open' : 'closed'}
            data-multiple={multiple ? 'true' : 'false'}
            style={rootStyle}
            onBlur={(event) => {
                if (multiple) {
                    return;
                }

                if (!event.currentTarget.contains(event.relatedTarget)) {
                    closeDropdown();
                }
            }}
        >
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={multiple ? selectedValues.join(',') : selectedOption?.value ?? ''}
                    required={required}
                />
            )}

            {leftIcon && renderIcon(leftIcon, 'dropdown__left-icon')}

            <button
                ref={triggerRef}
                id={dropdownId}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-activedescendant={
                    isOpen && focusedIndex >= 0
                        ? `${dropdownId}-option-${focusedIndex}`
                        : undefined
                }
                className={[
                    'dropdown__trigger',
                    leftIcon ? 'has-left-icon' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                    if (isOpen) {
                        closeDropdown();
                    } else {
                        openDropdown();
                    }
                }}
                onKeyDown={handleKeyDown}
                {...props}
            >
                <span
                    className={[
                        'dropdown__value',
                        accentOption ? `dropdown__value-${accentOption.variant}` : '',
                    ].filter(Boolean).join(' ')}
                    style={accentOption?.color ? { '--selected-option-color': accentOption.color } : undefined}
                >
                    {selectedOption?.icon && renderIcon(selectedOption.icon, 'dropdown__selected-icon')}
                    <span className="dropdown__value-text">{selectedLabel}</span>
                </span>
            </button>

            {renderIcon(rightIcon, 'dropdown__right-icon')}

            <div className="dropdown__menu">
                {searchable && (
                    <div className="dropdown__search">
                        <input
                            ref={searchRef}
                            className="dropdown__search-input"
                            type="search"
                            value={searchQuery}
                            placeholder={searchPlaceholder}
                            autoComplete="off"
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onKeyDown={handleSearchKeyDown}
                        />
                    </div>
                )}

                <div
                    id={listboxId}
                    role="listbox"
                    aria-multiselectable={multiple || undefined}
                    aria-labelledby={dropdownId}
                    className="dropdown__list"
                >
                    {filteredOptions.map((option) => {
                        const index = option.index;
                        const isSelected = multiple
                            ? selectedValues.includes(option.stringValue)
                            : option.stringValue === selectedOption?.stringValue;
                        const isFocused = index === focusedIndex;

                        return (
                            <div
                                key={`${option.stringValue}-${index}`}
                                id={`${dropdownId}-option-${index}`}
                                role="option"
                                aria-selected={isSelected}
                                aria-disabled={option.disabled}
                                className={[
                                    'dropdown__option',
                                    `dropdown__option-${option.variant}`,
                                    isSelected ? 'is-selected' : '',
                                    isFocused ? 'is-focused' : '',
                                    option.disabled ? 'is-disabled' : '',
                                ].filter(Boolean).join(' ')}
                                style={option.color ? { '--option-color-base': option.color } : undefined}
                                onMouseEnter={() => {
                                    if (!option.disabled) {
                                        setFocusedIndex(index);
                                    }
                                }}
                                onPointerDown={(event) => {
                                    if (!multiple) return;

                                    event.preventDefault();
                                    event.stopPropagation();
                                }}
                                onMouseDown={(event) => {
                                    if (multiple) {
                                        event.stopPropagation();
                                    }

                                    event.preventDefault();
                                }}
                                onClick={(event) => {
                                    if (multiple) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }

                                    selectOption(option);
                                }}
                            >
                                {multiple && (
                                    <input
                                        className="dropdown__checkbox"
                                        type="checkbox"
                                        checked={isSelected}
                                        readOnly
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                )}

                                {option.icon && renderIcon(option.icon, 'dropdown__option-icon')}

                                <span className="dropdown__option-label">{option.label}</span>
                            </div>
                        );
                    })}

                    {!filteredOptions.length && (
                        <div className="dropdown__empty">{noResultsText}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

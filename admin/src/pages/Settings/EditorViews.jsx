import { useEffect, useState, useCallback } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import api from '../../utils/api';

/**
 * EditorViews settings page.
 *
 * This page allows administrators to create and manage editor views
 * ("widgets" layouts) for a specific content type. It mirrors the
 * List Views page but provides additional UI for grouping fields into
 * widgets. Each editor view has:
 *  - label: human friendly name
 *  - slug: used in URLs
 *  - roles: roles that can use this view
 *  - default_roles: roles for which this view is default
 *  - sections: list of widgets, each with id, title, description,
 *    layout and an ordered array of field keys
 *
 * The page is structured in three stages: selecting a content type,
 * selecting an editor view, and editing that view. It reuses the same
 * hooks and styling as List Views for consistency.
 */
const EditorViews = () => {
  const { id } = useParams();
  const history = useHistory();
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [views, setViews] = useState([]);
  const [selectedView, setSelectedView] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available content types (same endpoint as List Views)
  useEffect(() => {
    async function fetchTypes() {
      try {
        const { data } = await api.get('/api/content-types');
        setContentTypes(data);
      } catch (err) {
        console.error('Failed to load content types', err);
      }
    }
    fetchTypes();
  }, []);

  // Load editor views when a content type is selected
  const loadViews = useCallback(async (typeId) => {
    if (!typeId) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/api/content-types/${typeId}/editor-views`);
      setViews(data);
    } catch (err) {
      console.error('Failed to load editor views', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select content type from chips
  const handleSelectType = (type) => {
    setSelectedType(type);
    setSelectedView(null);
    loadViews(type.id);
  };

  // Save or update an editor view
  const handleSaveView = async (view) => {
    if (!selectedType) return;
    try {
      const payload = {
        slug: view.slug,
        label: view.label,
        roles: view.roles,
        default_roles: view.default_roles,
        sections: view.sections
      };
      const { data } = await api.put(`/api/content-types/${selectedType.id}/editor-view`, payload);
      // reload views after save
      loadViews(selectedType.id);
      setSelectedView(data);
    } catch (err) {
      console.error('Failed to save editor view', err);
    }
  };

  // Delete an editor view
  const handleDeleteView = async (view) => {
    if (!selectedType) return;
    try {
      await api.delete(`/api/content-types/${selectedType.id}/editor-view/${view.slug}`);
      loadViews(selectedType.id);
      setSelectedView(null);
    } catch (err) {
      console.error('Failed to delete editor view', err);
    }
  };

  // Render selection of content types
  const renderTypeChips = () => (
    <div className="chips">
      {contentTypes.map((type) => (
        <button
          key={type.id}
          className={`chip ${selectedType?.id === type.id ? 'active' : ''}`}
          onClick={() => handleSelectType(type)}
        >
          {type.label}
        </button>
      ))}
      {isLoading && <span>Loading…</span>}
    </div>
  );

  // Render list of existing editor views
  const renderViewChips = () => (
    <div className="chips">
      {views.map((view) => (
        <button
          key={view.slug}
          className={`chip ${selectedView?.slug === view.slug ? 'active' : ''}`}
          onClick={() => setSelectedView(view)}
        >
          {view.label}
          {view.config?.default_roles?.length ? (
            <span className="default-badge">Default</span>
          ) : null}
        </button>
      ))}
      <button className="chip new" onClick={() => setSelectedView({
        slug: '',
        label: '',
        roles: [],
        default_roles: [],
        sections: []
      })}>+ New editor view</button>
    </div>
  );

  // Editor view editing form
  const renderEditorForm = () => {
    if (!selectedView) return null;

    const update = (field, value) => setSelectedView(prev => ({ ...prev, [field]: value }));
    const updateSections = (sections) => update('sections', sections);

    // Add new empty widget
    const addWidget = () => {
      const index = selectedView.sections.length + 1;
      updateSections([
        ...selectedView.sections,
        {
          id: `widget-${index}`,
          title: `Widget ${index}`,
          description: '',
          layout: 'one-column',
          fields: []
        }
      ]);
    };

    // Render each widget card
    const renderWidgets = () => (
      selectedView.sections.map((w, idx) => (
        <div key={w.id} className="widget-card">
          <input
            type="text"
            value={w.title}
            onChange={e => {
              const sections = [...selectedView.sections];
              sections[idx].title = e.target.value;
              updateSections(sections);
            }}
            placeholder="Widget title"
          />
          <textarea
            value={w.description || ''}
            onChange={e => {
              const sections = [...selectedView.sections];
              sections[idx].description = e.target.value;
              updateSections(sections);
            }}
            placeholder="Widget description (optional)"
          />
          {/* In a real implementation, you would list available fields
              and allow dragging/dropping into this widget. For brevity,
              we show field keys in a simple comma-separated input. */}
          <input
            type="text"
            value={w.fields.join(', ')}
            onChange={e => {
              const sections = [...selectedView.sections];
              sections[idx].fields = e.target.value.split(',').map(f => f.trim()).filter(Boolean);
              updateSections(sections);
            }}
            placeholder="Comma-separated field keys"
          />
        </div>
      ))
    );

    return (
      <div className="editor-form">
        <h3>Editor View</h3>
        <label>
          Label
          <input
            type="text"
            value={selectedView.label || ''}
            onChange={e => update('label', e.target.value)}
          />
        </label>
        <label>
          Slug
          <input
            type="text"
            value={selectedView.slug || ''}
            onChange={e => update('slug', e.target.value.replace(/\s+/g, '-').toLowerCase())}
          />
        </label>
        <label>
          Roles (comma separated)
          <input
            type="text"
            value={selectedView.roles?.join(', ') || ''}
            onChange={e => update('roles', e.target.value.split(',').map(r => r.trim()).filter(Boolean))}
          />
        </label>
        <label>
          Default Roles (comma separated)
          <input
            type="text"
            value={selectedView.default_roles?.join(', ') || ''}
            onChange={e => update('default_roles', e.target.value.split(',').map(r => r.trim()).filter(Boolean))}
          />
        </label>
        <h4>Widgets</h4>
        {renderWidgets()}
        <button onClick={addWidget}>+ Add Widget</button>
        <div className="actions">
          <button onClick={() => handleSaveView(selectedView)}>Save</button>
          {selectedView.slug && (
            <button onClick={() => handleDeleteView(selectedView)}>Delete</button>
          )}
          <button onClick={() => setSelectedView(null)}>Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="editor-views-page">
      <h2>Entry Editor Views</h2>
      {/* Stage 1: pick content type */}
      {renderTypeChips()}
      {/* Stage 2: pick editor view */}
      {selectedType && renderViewChips()}
      {/* Stage 3: edit view */}
      {selectedType && renderEditorForm()}
    </div>
  );
};

export default EditorViews;

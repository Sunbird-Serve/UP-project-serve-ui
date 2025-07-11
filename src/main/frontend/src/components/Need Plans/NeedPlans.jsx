import React, { useEffect, useState } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './NeedPlans.css'
import moment from 'moment';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import IconButton from '@mui/material/IconButton'; // Import IconButton from Material-UI
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import TodayIcon from '@mui/icons-material/Today';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import noRecords from '../../assets/noRecords.png'
import { useSelector, useDispatch } from 'react-redux'
import axios from 'axios'
import randomColor from 'randomcolor'
import Avatar from '@mui/material/Avatar';
import {format} from 'date-fns'
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const configData = require('../../configure.js');

const localizer = momentLocalizer(moment);

const NeedPlans = () => {
  const userId = useSelector((state)=> state.user.data.osid) //For current user

  //get all fulfillments corresponding to an user
  const [fulfillments, setFulfillments] = useState([])
  useEffect(()=>{
    if(userId){
      axios.get(`${configData.SERVE_FULFILL}/fulfillment/coordinator-read/${userId}?page=0&size=10`)
      .then(response => {
          setFulfillments(response.data)
      })
      .catch(error => {
          console.log(error)
      });
    }
  },[userId])
  console.log(fulfillments)

  //fetch all plans: plans created by joining needs, plans and platforms 
  const [needPlans, setNeedPlans] = useState([]);
  const [error, setError] = useState(null);

  const fetchAllPlans = async () => {
    if (!fulfillments.length) return;
    const fetchRequests = fulfillments.map(obj => {
      const { needId, needPlanId } = obj;
      // Fetch needPlan details
      const fetchNeedPlan = axios.get(`${configData.SERVE_NEED}/need-plan/read/${needPlanId}`)
        .then(response => response.data)
        .catch(error => {
          console.error(`Error fetching needPlan for ${needPlanId}:`, error);
          return null;
        });
      // Fetch need details
      const fetchNeed = axios.get(`${configData.SERVE_NEED}/need/${needId}`)
        .then(response => response.data)
        .catch(error => {
          console.error(`Error fetching need for ${needId}:`, error);
          return null;
        });
      // Fetch platform details
      const fetchPlatform = axios.get(`${configData.SERVE_NEED}/need-deliverable/${needPlanId}`)
        .then(response => response.data)
        .catch(error => {
          return null;
        });
      return Promise.all([fetchNeedPlan, fetchNeed, fetchPlatform])
        .then(([needPlan, need, platform]) => ({
          ...obj,
          needPlan,
          need,
          platform
        }));
    });
    const results = await Promise.all(fetchRequests);
    setNeedPlans(results.filter(result => result !== null));
  };

  useEffect(() => {
    fetchAllPlans();
  }, [fulfillments]);
  console.log(needPlans)

  //counts
  // Extract needId and assignedUserId arrays
  const needIds = needPlans.map(item => item.needId);
  const assignedUserIds = needPlans.map(item => item.assignedUserId);
  // Create sets to get unique values
  const uniqueNeedIds = new Set(needIds);
  const uniqueAssignedUserIds = new Set(assignedUserIds);
  // Get the count of unique values
  const needIdCount = uniqueNeedIds.size;
  const assignedUserIdCount = uniqueAssignedUserIds.size;

  //this is for showing alloted voluteer details
  const userList = useSelector((state) => state.userlist.data);
  const userMap = {}
  const userContact = {}
  for (const user of userList){
    userMap[user.osid] = user.identityDetails.fullname;
    userContact[user.osid] = user.contactDetails.mobile;
  }

  const formatTime = (timeData, timeZone) => {
    // Check if timeData is valid
    if (!timeData || timeData === "" || timeData === null || timeData === undefined) {
      return "00:00"; // Return default time if no valid time data
    }
    
    try {
      // Handle different time data formats
      let date;
      if (typeof timeData === 'string') {
        // If it's already a time string (HH:MM format), return it directly
        if (/^\d{1,2}:\d{2}$/.test(timeData)) {
          return timeData;
        }
        // If it's an ISO date string or other date format
        date = new Date(timeData);
      } else if (timeData instanceof Date) {
        date = timeData;
      } else {
        // Try to create a date from the value
        date = new Date(timeData);
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', timeData);
        return "00:00"; // Return default time if invalid date
      }
      
      const options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        timeZone: timeZone || 'UTC',
      };
    
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
      console.warn('Error formatting time:', error, 'timeData:', timeData);
      return "00:00"; // Return default time on any error
    }
  };

  //make the events from start to end date
  function getTimeSlots(needName, startDate, endDate, timeSlots, assignedUserId, needId, platform, meetURL, startTime, endTime) {
    // Validate inputs
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      console.warn('Invalid timeSlots data:', timeSlots);
      return [];
    }
    
    if (!startDate || !endDate) {
      console.warn('Invalid date range:', { startDate, endDate });
      return [];
    }
    
    const timeSlotObject = {};
    timeSlots.forEach(slot => {
      if (slot && slot.day && slot.startTime && slot.endTime) {
        const day = slot.day.toLowerCase();
        // Use the custom formatTime function instead of date-fns format
        timeSlotObject[day] = [formatTime(slot.startTime, 'UTC'), formatTime(slot.endTime, 'UTC')];
      } else {
        console.warn('Invalid time slot data:', slot);
      }
    });
  
    const dateWithTimeSlots = [];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    // Validate dates
    if (isNaN(currentDate.getTime()) || isNaN(endDateObj.getTime())) {
      console.warn('Invalid date values:', { startDate, endDate });
      return [];
    }
    
    while (currentDate <= endDateObj) {
      const dayIndex = currentDate.getDay();
      const day = daysOfWeek[dayIndex];
      if (timeSlotObject[day]) {
        dateWithTimeSlots.push({
          title: needName,
          start: currentDate.toDateString(), //for session
          end: currentDate.toDateString(), //for session
          startTime: formatTime(startTime, 'Asia/Kolkata'),
          endTime: formatTime(endTime, 'Asia/Kolkata'),
          startDate: new Date(startDate).toDateString(),//for entire plan
          endDate: new Date(endDate).toDateString(),//for entire plan
          assignedUserId: assignedUserId,
          needId: needId,
          softwarePlatform: platform,
          inputUrl: meetURL
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return dateWithTimeSlots;
  }
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const newEvents = [];
    for (const item of needPlans) {
      try {
        if (item.needPlan && item.needPlan.occurrence !== null && item.needPlan.timeSlots) {
          const { startDate, endDate } = item.needPlan.occurrence;
          let inputURL = "";
          let softwarePlatform = "";
          let startTime = "";
          let endTime = "";
          
          if (item.platform && item.platform.inputParameters && item.platform.inputParameters.length > 0) {
            inputURL = item.platform.inputParameters[0].inputUrl || "";
            softwarePlatform = item.platform.inputParameters[0].softwarePlatform || "";
            startTime = item.platform.inputParameters[0].startTime || "";
            endTime = item.platform.inputParameters[0].endTime || "";
          }
          
          const sessions = getTimeSlots(
            item.needPlan.plan?.name || "Unknown Need", 
            startDate, 
            endDate, 
            item.needPlan.timeSlots, 
            item.assignedUserId, 
            item.needId, 
            softwarePlatform, 
            inputURL, 
            startTime, 
            endTime
          );
          newEvents.push(...sessions);
        }
      } catch (error) {
        console.error('Error processing need plan:', error, item);
      }
    }
    setEvents(newEvents);
  }, [needPlans]);
  console.log(events) //in format of calender

  const grouped = events.reduce((acc, plan) => {
    const key = `${plan.start}-${plan.needId}`;
    if (!acc[key]) {
        acc[key] = {
            needId: plan.needId,
            start: plan.start,
            end: plan.end,
            startTime: plan.startTime,
            endTime: plan.endTime,
            startDate: plan.startDate,
            endDate: plan.endDate,
            title: plan.title,
            inputUrl: plan.inputUrl,
            softwarePlatform: plan.softwarePlatform,
            assignedUsers: []
        };
    }

    // Only add the userId if it's not already in the array
    if (!acc[key].assignedUsers.includes(plan.assignedUserId)) {
        acc[key].assignedUsers.push(plan.assignedUserId);
    }

    return acc;
  }, {});
  const schedules = Object.values(grouped)
  // console.log(schedules)  //for navigation on right

  //view of calender: to show monthwise
  const views = {
    month: true,
    week: false,
    day: false,
    agenda: false,
  }
  //styling of cells inside calender
  const customEventPropGetter = (event, start, end, isSelected) => {
    const eventStyle = {
      backgroundColor: 'white', 
      borderRadius: '5px',
      color: 'black',
      boxShadow: "2px 0px #0080BC inset",
      border: 'solid 1px #DBDBDB'
    };
    const currentDate = end;
    return {
      style: eventStyle,
    };
  };

  const CustomToolbar = ({ onNavigate, label }) => (
    <div className="custom-toolbar">
      <IconButton onClick={() => onNavigate('PREV')}>
        <KeyboardArrowLeftIcon />
      </IconButton>
      <IconButton onClick={() => onNavigate('TODAY')}>
        <TodayIcon />
      </IconButton>
      <IconButton onClick={() => onNavigate('NEXT')}>
        <KeyboardArrowRightIcon />
      </IconButton>
      <div className="calendar-month-year">
        {moment(label).format('MMMM YYYY')} {/* Display month and year */}
      </div>
    </div>
  );

  const [selectedDate, setSelectedDate] = useState(new Date()); // State to store selected date

  useEffect(() => {
    const selectedDateString = moment(selectedDate).format('YYYY-MM-DD');
    setSelectedDate(selectedDateString); 
  }, [selectedDate]);

  const handleSelectSlot = (slotInfo) => {
    const selectedDateString = moment(slotInfo.start).format('YYYY-MM-DD');
    setSelectedDate(selectedDateString); 
  };

  // to show selection of date on calender
  const customDayPropGetter = (date) => {
    const isSelectedDate = moment(date).format('YYYY-MM-DD') === selectedDate;
    const classNames = isSelectedDate ? 'selected-date-cell' : '';
    return { className: classNames };
  };
  
  const [expandEvent, setExpandEvent] = useState(false)
  const [clickedEvent, setClickedEvent] = useState(null)
  const handleEventClick = Index => {
    console.log(Index)
    setClickedEvent(Index)
    setExpandEvent(!expandEvent)
  }

  // Add at the top level of the component (after other useState hooks)
  const [editSession, setEditSession] = useState(null); // { userId, eventKey }
  const [editFields, setEditFields] = useState({ status: '', comments: '', students: '' });
  const [showAddSession, setShowAddSession] = useState(false);
  const [editError, setEditError] = useState('');

  return (
      <div>
        <div className="wrapCalender">
          <Calendar className="ncCalender"
            localizer={localizer}
            events={events}     //data into calender
            startAccessor="start"
            endAccessor="end"
            views={views}   //which views to enable or disable
            style={{ width: 840 }} // Set the overall calendar width
            eventPropGetter={customEventPropGetter}
            components={{
              toolbar: CustomToolbar,
            }}
            selectable={true} // Enable date selection
            onSelectSlot={handleSelectSlot} // Handle date slot selection
            dayPropGetter={customDayPropGetter} // Apply custom day cell styling
          />
          
          {/* Side List showing list of events */}
          { selectedDate && ( <div className="event-list-nc">
          {/* Need and Volunteer Stats */}
          <div className="stats-need-volunteer">
              <div className="needCountNC">
                <i><StickyNote2Icon /></i> 
                <span>{needIdCount} Needs</span>
              </div>
              <div className="volunteerCountNC">
                <i><PeopleAltIcon /></i> 
                <span>{assignedUserIdCount} Volunteers</span>
              </div>
          </div>
          {/* Selected Event Date */}
          <div className="headEventListNC">{moment(selectedDate).format('MMMM D, YYYY')}</div>
          {/* EVENTS LIST when selected date falls within date range of any event */}
          { schedules.filter((event) => {
            const startDate = moment(event.start);
            const endDate = moment(event.end)
            const selected = moment(selectedDate)
            return selected.isSameOrAfter(startDate) && selected.isSameOrBefore(endDate);
            })
            .map((event, index) => (
            <div className="dayEventListNC" key={event.start} >
              <button className="dayEventItemNC" onClick={()=>handleEventClick(index)}>
                <div className="dayEventTitleNC" >
                  <div className="wrap-nameDayEventNC">
                    <i> { expandEvent ? <ExpandMoreIcon/> : <ChevronRightIcon /> } </i>
                    <span className="nameDayEventNC">{event.title}</span>
                  </div>
                  <div className="wrap-timeDayEventNC">
                    <span className="timeDayEventNC">
                      <i><AccessTimeIcon style={{fontSize:"18px",color:'grey',paddingBottom:"2px"}}/></i>
                      {event.startTime} - {event.endTime}
                    </span>
                  </div>
                </div>
                <div className="dayEventDateNC"> {event.startDate.slice(4,10)} - {event.endDate.slice(4,10)} </div>
              </button>
              { expandEvent && ( index === clickedEvent ) && (
                <>
                  {/* Session Details Section */}
                  <div className="session-details-card" style={{background: '#f7fafd', border: '1.5px solid #0080BC', borderRadius: 10, margin: '16px 0', padding: 16, boxShadow: '0 2px 8px rgba(0,128,188,0.07)'}}>
                    <div style={{fontWeight: 'bold', fontSize: 16, color: '#0080BC', marginBottom: 10}}>Session Details</div>
                    {event.assignedUsers.map((user) => {
                      const plan = needPlans.find(np => np.needId === event.needId && user === np.assignedUserId);
                      let deliverable = null;
                      if (plan && plan.platform && plan.platform.needDeliverable && plan.platform.needDeliverable.length > 0) {
                        deliverable = plan.platform.needDeliverable.find(d => {
                          if (!d.deliverableDate) return false;
                          return new Date(d.deliverableDate).toDateString() === event.start;
                        }) || plan.platform.needDeliverable[0];
                      }
                      const isEditing = editSession && editSession.userId === user && editSession.eventKey === event.start;
                      const handleEdit = () => {
                        setEditSession({ userId: user, eventKey: event.start });
                        setEditFields({
                          status: deliverable?.status || '',
                          comments: deliverable?.comments || '',
                          students: deliverable?.numberOfAttendees || deliverable?.numStudents || ''
                        });
                        setEditError('');
                      };
                      const handleFieldChange = (field, value) => {
                        setEditFields(prev => ({ ...prev, [field]: value }));
                        setEditError('');
                      };
                      const handleSave = async () => {
                        // Validation: all fields required
                        if (!editFields.status || !editFields.comments || !editFields.students) {
                          setEditError('All fields are required.');
                          return;
                        }
                        if (!deliverable || !plan) {
                          setEditError('Missing deliverable or plan data.');
                          return;
                        }
                        const needPlanIdToSend = plan?.needPlan?.id || deliverable?.needPlanId;
                        if (!needPlanIdToSend) {
                          setEditError('Could not determine needPlanId for this deliverable.');
                          return;
                        }
                        const payload = {
                          needPlanId: needPlanIdToSend,
                          comments: editFields.comments,
                          status: editFields.status,
                          deliverableDate: deliverable.deliverableDate,
                          numberOfAttendees: editFields.students
                        };
                        console.log('Deliverable update payload:', payload);
                        try {
                          await axios.put(
                            `${configData.NEEDPLAN_DELIVERABLES}/update/${deliverable.id}`,
                            payload
                          );
                          // Update local state for needPlans
                          setNeedPlans(prevNeedPlans =>
                            prevNeedPlans.map(np => {
                              if (
                                np.needId === plan.needId &&
                                np.assignedUserId === user
                              ) {
                                // Update the deliverable in platform.needDeliverable
                                const updatedPlatform = { ...np.platform };
                                if (updatedPlatform.needDeliverable) {
                                  updatedPlatform.needDeliverable = updatedPlatform.needDeliverable.map(d =>
                                    d.id === deliverable.id
                                      ? {
                                          ...d,
                                          status: editFields.status,
                                          comments: editFields.comments,
                                          numberOfAttendees: editFields.students,
                                        }
                                      : d
                                  );
                                }
                                return { ...np, platform: updatedPlatform };
                              }
                              return np;
                            })
                          );
                          setEditSession(null);
                          setEditError('');
                        } catch (error) {
                          setEditError('Failed to update deliverable.');
                        }
                      };
                      const handleCancel = () => {
                        setEditSession(null);
                      };
                      return (
                        <div className="user-boxNC" key={user} style={{marginBottom: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: 12}}>
                          <div className="userNameNC">
                            <div><Avatar style={{padding:'5px',height:'24px',width:'24px',fontSize:'16px',backgroundColor:randomColor()}}></Avatar></div>
                            <div className="userName-eventList">{userMap[user]}</div>
                          </div>
                          <div className="userContact-eventList">{userContact[user]}</div>
                          {deliverable && !isEditing && (
                            <div className="session-details-NC" style={{marginTop: 6, fontSize: 13, color: '#333'}}>
                              <div><b>Status:</b> {deliverable.status || '-'}</div>
                              <button style={{marginTop: 8, background: '#0080BC', color: 'white', border: 'none', borderRadius: 4, padding: '4px 16px', fontWeight: 500, cursor: 'pointer'}} onClick={handleEdit}>Edit</button>
                            </div>
                          )}
                          {deliverable && isEditing && (
                            <div className="session-details-NC-edit" style={{marginTop: 6, fontSize: 13, color: '#333', display: 'flex', flexDirection: 'column', gap: 8}}>
                              <div>
                                <b>Status:</b>
                                <select value={editFields.status} onChange={e => handleFieldChange('status', e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4}} required>
                                  <option value="">Select Status</option>
                                  <option value="Planned">Planned</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Cancelled">Cancelled</option>
                                </select>
                              </div>
                              {editFields.status === 'Completed' && (
                                <div>
                                  <b>Comments:</b>
                                  <input type="text" value={editFields.comments} onChange={e => handleFieldChange('comments', e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4, width: 180}} required />
                                </div>
                              )}
                              {editFields.status === 'Cancelled' && (
                                <div>
                                  <b>Comments:</b>
                                  <select value={editFields.comments} onChange={e => handleFieldChange('comments', e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4, width: 180}} required>
                                    <option value="">Select Reason</option>
                                    <option value="Network Issue">Network Issue</option>
                                    <option value="Power Cut">Power Cut</option>
                                    <option value="Students Not Available">Students Not Available</option>
                                  </select>
                                </div>
                              )}
                              <div>
                                <b>Students Number:</b>
                                <input type="number" value={editFields.students} onChange={e => handleFieldChange('students', e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4, width: 80}} required min={1} />
                              </div>
                              {editError && <div style={{color: 'red', fontSize: 12, marginTop: 4}}>{editError}</div>}
                              <div style={{marginTop: 8, display: 'flex', gap: 8}}>
                                <button style={{background: '#0080BC', color: 'white', border: 'none', borderRadius: 4, padding: '4px 16px', fontWeight: 500, cursor: 'pointer'}} onClick={handleSave}>Save</button>
                                <button style={{background: '#aaa', color: 'white', border: 'none', borderRadius: 4, padding: '4px 16px', fontWeight: 500, cursor: 'pointer'}} onClick={handleCancel}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Add New Session Link/Button */}
                  <div style={{margin: '16px 0'}}>
                    <button
                      style={{background: 'none', color: '#0080BC', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', textDecoration: 'underline'}}
                      onClick={() => setShowAddSession(v => !v)}
                    >
                      {showAddSession ? 'Hide Add New Session' : 'Add New Session'}
                    </button>
                  </div>
                  {showAddSession && (
                    // Find the plan for the first assigned user in this event
                    (() => {
                      const firstUser = event.assignedUsers[0];
                      const planForAdd = needPlans.find(np => np.needId === event.needId && firstUser === np.assignedUserId);
                      return (
                    <div className="add-session-card" style={{background: '#f7fafd', border: '1.5px solid #0080BC', borderRadius: 10, margin: '16px 0', padding: 16, boxShadow: '0 2px 8px rgba(0,128,188,0.07)', fontSize: 13}}>
                      <div style={{fontWeight: 'bold', fontSize: 16, color: '#0080BC', marginBottom: 10}}>Add New Session</div>
                      <AddSessionForm plan={planForAdd} setNeedPlans={setNeedPlans} setShowAddSession={setShowAddSession} fetchAllPlans={fetchAllPlans} />
                    </div>
                      );
                    })()
                  )}
                </>
              )}
            </div>
          )) }


          {/* NO EVENTS LIST */}
          {!events.some((event) => {
            const startDate = moment(event.start);
            const endDate = moment(event.end);
            const selected = moment(selectedDate);
            return selected.isSameOrAfter(startDate) && selected.isSameOrBefore(endDate);
            }) && ( <div className="noEventsOnDay">
              <img src={noRecords} alt="No Events" />
              <p>No needs scheduled on this date</p>
            </div>
          )}

          </div>
          )}
        </div>
      </div>

  );
}

function AddSessionForm({ plan, setNeedPlans, setShowAddSession, fetchAllPlans }) {
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Debug logs
  console.log('AddSessionForm plan:', plan);
  if (plan) {
    console.log('plan.needPlan:', plan.needPlan);
    if (plan.needPlan) {
      console.log('plan.needPlan.id:', plan.needPlan.id);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      setError("All fields are required.");
      return;
    }
    if (!plan || !plan.needPlanId) {
      setError("Plan information missing.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // First API: create deliverable
      const payload = {
        needPlanId: plan.needPlanId,
        comments: "",
        status: "Planned",
        deliverableDate: `${date}T00:00:00.000Z`
      };
      const res = await axios.post(`${configData.NEEDPLAN_DELIVERABLES}/create`, payload);
      const newDeliverable = res.data;
      // Second API: create deliverable input
      const inputPayload = {
        needDeliverableId: newDeliverable.id,
        startTime: `${date}T${startTime}:00.000Z`,
        endTime: `${date}T${endTime}:00.000Z`
      };
      await axios.post(`${configData.SERVE_NEED}/deliverable-input/create`, inputPayload);
      // Instead of updating just one plan, trigger a full reload
      if (fetchAllPlans) await fetchAllPlans();
      setShowAddSession(false);
    } catch (err) {
      setError("Failed to add session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form style={{display: 'flex', flexDirection: 'column', gap: 10}} onSubmit={handleSubmit}>
      <div>
        <label>Date: <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4}} required /></label>
      </div>
      <div>
        <label>Start Time: <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4}} required /></label>
      </div>
      <div>
        <label>End Time: <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{marginLeft: 8, padding: 4, borderRadius: 4}} required /></label>
      </div>
      {error && <div style={{color: 'red', fontSize: 12}}>{error}</div>}
      <button type="submit" disabled={loading} style={{marginTop: 8, background: '#0080BC', color: 'white', border: 'none', borderRadius: 4, padding: '6px 20px', fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-start'}}>
        {loading ? 'Adding...' : 'Add Session'}
      </button>
    </form>
  );
}

export default NeedPlans;